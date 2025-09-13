import COS from 'cos-nodejs-sdk-v5';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import { cosConfig, hasValidConfig } from './config.js';
import { saveProgress, loadProgress, clearProgress } from './uploadProgress.js';
import { TEMP_DIRS, getTempDirStats, cleanupTempFiles } from './tempManager.js';

/**
 * 腾讯云COS服务封装类
 * 提供文件上传、下载、管理等操作的统一接口
 */
class TencentCOSService {
  /**
   * 构造函数 - 初始化COS服务实例
   */
  constructor() {
    this.configValid = hasValidConfig();
    
    if (this.configValid) {
      this.cos = new COS({
        SecretId: cosConfig.SecretId,
        SecretKey: cosConfig.SecretKey
      });
    }
    this.config = cosConfig;
  }

  /**
   * 检查COS配置是否有效
   * @throws {Error} 当配置无效时抛出错误
   * @private
   */
  _checkConfig() {
    if (!this.configValid) {
      throw new Error('COS配置无效，请检查环境变量设置');
    }
  }

  /**
   * 上传单个文件到COS
   * @param {string} localPath - 本地文件路径
   * @param {Object} options - 上传选项
   * @param {string} [options.key] - COS中的对象键，不提供则使用文件名
   * @param {string} [options.customDomain] - 自定义访问域名
   * @param {boolean} [options.useSliceUpload] - 强制使用分片上传
   * @param {number} [options.chunkSize] - 分片大小（字节），默认1MB
   * @param {number} [options.concurrency] - 并发上传数，默认3
   * @param {Function} [options.onProgress] - 进度回调函数
   * @returns {Promise<Object>} 上传结果，包含URL、键名、ETag等信息
   * @throws {Error} 上传失败时抛出错误
   */
  async uploadFile(localPath, {
    key = null,
    customDomain = null,
    useSliceUpload = false,
    chunkSize = 1024 * 1024, // 1MB
    concurrency = 3,
    onProgress = null
  } = {}) {
    this._checkConfig();

    try {
      // 获取文件状态
      const stats = await fs.stat(localPath);
      const fileSize = stats.size;

      // 生成key，如果没提供则使用文件名
      const objectKey = key || path.basename(localPath);

      // 判断是否使用分片上传 (文件大于5MB或强制指定)
      const shouldUseSliceUpload = useSliceUpload || fileSize > (5 * 1024 * 1024);

      if (shouldUseSliceUpload) {
        return await this._uploadLargeFile(localPath, objectKey, {
          customDomain,
          chunkSize,
          concurrency,
          onProgress,
          fileSize
        });
      }

      // 小文件直接上传
      const buffer = await fs.readFile(localPath);
      const params = {
        Bucket: this.config.Bucket,
        Region: this.config.Region,
        Key: objectKey,
        Body: buffer,
      };

      const response = await this.cos.putObject(params);

      // 上传成功后清理相关临时文件
      try {
        await this._cleanupUploadTempFiles(objectKey);
      } catch (clearErr) {
        // 清理临时文件失败时静默处理，不影响上传成功的结果
      }

      // 生成访问URL
      const domain = customDomain || this.config.Domain || `https://${this.config.Bucket}.cos.${this.config.Region}.myqcloud.com`;
      const fileUrl = `${domain}/${objectKey}`;

      return {
        success: true,
        url: fileUrl,
        key: objectKey,
        etag: response.ETag,
        location: response.Location,
        size: fileSize,
        uploadType: 'direct'
      };
    } catch (error) {
      // 上传失败时，清理可能产生的临时文件
      try {
        await this._cleanupUploadTempFiles(objectKey);
      } catch (clearErr) {
        // 清理失败时静默处理
      }

      console.error('上传失败:', error);
      throw new Error(`文件上传失败: ${error.message}`);
    }
  }

  /**
   * 大文件分片上传核心方法，支持断点续传
   * @param {string} localPath - 本地文件路径
   * @param {string} objectKey - COS对象键
   * @param {Object} options - 上传选项
   * @returns {Promise<Object>} 上传结果
   * @private
   */
  async _uploadLargeFile(localPath, objectKey, options) {
    const {
      customDomain,
      chunkSize = 1024 * 1024, // 1MB
      concurrency = 3,
      onProgress,
      fileSize
    } = options;

    // 生成上传会话ID用于断点续传
    const sessionId = await this._generateUploadSessionId(localPath, objectKey, chunkSize);

    try {
      // 检查是否有未完成的上传
      const savedProgress = await loadProgress(sessionId);
      if (savedProgress && savedProgress.uploadId) {
        // 发现未完成的上传，继续上传 (静默处理)
      }

      return new Promise((resolve, reject) => {
        let currentUploadId = null;

        // 使用腾讯云COS SDK的分片上传功能
        this.cos.sliceUploadFile({
          Bucket: this.config.Bucket,
          Region: this.config.Region,
          Key: objectKey,
          FilePath: localPath,
          ChunkSize: chunkSize,
          AsyncLimit: concurrency, // 并发数
          UploadIdCacheLimit: 500, // 缓存UploadId数量
          onProgress: async (progressData) => {
            // 保存进度信息
            if (currentUploadId) {
              try {
                await saveProgress(sessionId, {
                  uploadId: currentUploadId,
                  filePath: localPath,
                  objectKey,
                  fileSize,
                  chunkSize,
                  percent: progressData.percent,
                  speed: progressData.speed || 0
                });
              } catch (err) {
                // 保存进度失败时静默处理，不影响上传
              }
            }

            if (onProgress) {
              onProgress({
                loaded: Math.round(progressData.percent * fileSize / 100),
                total: fileSize,
                percent: progressData.percent,
                speed: progressData.speed || 0,
                sessionId: sessionId
              });
            }
          },
          onTaskReady: (taskId) => {
            currentUploadId = taskId;
            // 分片上传开始 (静默处理)
          }
        }, async (err, data) => {
          if (err) {
            // 上传失败时保持进度文件，便于下次续传
            // 但清理其他临时文件以避免磁盘空间占用
            try {
              await this._cleanupFailedUpload(sessionId, objectKey);
            } catch (clearErr) {
              // 清理失败时静默处理
            }
            reject(new Error(`分片上传失败: ${err.message}`));
          } else {
            // 上传成功，清理进度文件和相关临时资源
            try {
              await clearProgress(sessionId);

              // 清理可能的临时上传文件
              await this._cleanupUploadTempFiles(objectKey);
            } catch (clearErr) {
              // 清理临时文件失败时静默处理，不影响上传成功的结果
            }

            // 生成访问URL
            const domain = customDomain || this.config.Domain || `https://${this.config.Bucket}.cos.${this.config.Region}.myqcloud.com`;
            const fileUrl = `${domain}/${objectKey}`;

            resolve({
              success: true,
              url: fileUrl,
              key: objectKey,
              etag: data.ETag,
              location: data.Location,
              size: fileSize,
              uploadType: 'slice',
              uploadId: data.UploadId || currentUploadId,
              sessionId: sessionId
            });
          }
        });
      });
    } catch (error) {
      // 分片上传过程中发生异常时，清理临时文件但保留进度文件
      try {
        await this._cleanupFailedUpload(sessionId, objectKey);
      } catch (clearErr) {
        // 清理失败时静默处理
      }
      throw new Error(`断点续传上传失败: ${error.message}`);
    }
  }

  /**
   * 生成上传会话ID，用于断点续传标识
   * @param {string} filePath - 文件路径
   * @param {string} objectKey - 对象键
   * @param {number} chunkSize - 分片大小
   * @returns {Promise<string>} 会话ID
   * @private
   */
  async _generateUploadSessionId(filePath, objectKey, chunkSize) {
    const stats = await fs.stat(filePath);
    const content = `${filePath}-${objectKey}-${stats.size}-${chunkSize}-${stats.mtime.getTime()}`;
    return crypto.createHash('md5').update(content).digest('hex');
  }

  /**
   * 清理上传过程中产生的临时文件
   * @param {string} objectKey - 对象键
   * @returns {Promise<void>}
   * @private
   */
  async _cleanupUploadTempFiles(objectKey) {
    try {
      // 清理可能的临时上传文件（基于对象键生成的临时文件）
      const tempFileName = `${objectKey.replace(/[^a-zA-Z0-9]/g, '_')}_temp`;
      const tempFilePaths = [
        path.join(TEMP_DIRS.UPLOADS, tempFileName),
        path.join(TEMP_DIRS.UPLOADS, `${tempFileName}.part`),
        path.join(TEMP_DIRS.UPLOADS, `${tempFileName}.tmp`)
      ];

      for (const tempFilePath of tempFilePaths) {
        try {
          await fs.unlink(tempFilePath);
        } catch (error) {
          // 临时文件可能不存在，忽略错误
        }
      }

      // 清理相关的缓存文件
      const cacheFileName = `${objectKey.replace(/[^a-zA-Z0-9]/g, '_')}_cache.json`;
      const cacheFilePaths = [
        path.join(TEMP_DIRS.CACHE, cacheFileName),
        path.join(TEMP_DIRS.CACHE, `${cacheFileName}.bak`),
        path.join(TEMP_DIRS.CACHE, `upload_${cacheFileName}`)
      ];

      for (const cacheFilePath of cacheFilePaths) {
        try {
          await fs.unlink(cacheFilePath);
        } catch (error) {
          // 缓存文件可能不存在，忽略错误
        }
      }

      // 清理可能的分片临时目录
      const chunkDirName = `chunks_${objectKey.replace(/[^a-zA-Z0-9]/g, '_')}`;
      const chunkDirPath = path.join(TEMP_DIRS.UPLOADS, chunkDirName);

      try {
        // 先清理目录内的文件，再删除目录
        const { readdir, rmdir } = await import('fs/promises');
        const files = await readdir(chunkDirPath);
        for (const file of files) {
          await fs.unlink(path.join(chunkDirPath, file));
        }
        await rmdir(chunkDirPath);
      } catch (error) {
        // 目录可能不存在，忽略错误
      }
    } catch (error) {
      // 清理失败时静默处理，不影响主流程
    }
  }

  /**
   * 在上传失败或中断时清理所有相关的临时资源
   * @param {string} sessionId - 会话ID
   * @param {string} objectKey - 对象键
   * @returns {Promise<void>}
   * @private
   */
  async _cleanupFailedUpload(sessionId, objectKey) {
    try {
      // 注意：失败时保留进度文件以支持断点续传
      // 但清理其他临时文件
      await this._cleanupUploadTempFiles(objectKey);
    } catch (error) {
      // 清理失败时静默处理
    }
  }

  /**
   * 获取所有未完成的上传进度
   * @param {string} [sessionId] - 特定会话ID，不提供则返回所有
   * @returns {Promise<Object>} 进度信息
   */
  async getUploadProgress(sessionId = null) {
    try {
      if (sessionId) {
        const progress = await loadProgress(sessionId);
        return {
          success: true,
          sessionId,
          progress: progress || null
        };
      }

      // 获取所有进度文件
      const { readdir } = await import('fs/promises');
      try {
        const files = await readdir(TEMP_DIRS.PROGRESS);
        const progressList = [];

        for (const file of files) {
          if (file.endsWith('.json')) {
            const id = file.replace('.json', '');
            const progress = await loadProgress(id);
            if (progress) {
              progressList.push({
                sessionId: id,
                ...progress
              });
            }
          }
        }

        return {
          success: true,
          totalUploads: progressList.length,
          uploads: progressList
        };
      } catch (err) {
        // 目录不存在时返回空列表
        return {
          success: true,
          totalUploads: 0,
          uploads: []
        };
      }
    } catch (error) {
      throw new Error(`获取上传进度失败: ${error.message}`);
    }
  }

  /**
   * 清理指定的上传进度
   * @param {string} sessionId - 会话ID
   * @returns {Promise<Object>} 清理结果
   */
  async clearUploadProgress(sessionId) {
    try {
      await clearProgress(sessionId);
      return {
        success: true,
        sessionId,
        message: '进度记录已清理'
      };
    } catch (error) {
      throw new Error(`清理进度失败: ${error.message}`);
    }
  }

  /**
   * 管理临时文件
   * @param {string} action - 操作类型：'stats' 或 'cleanup'
   * @param {Object} [options] - 选项
   * @param {string} [options.type='all'] - 文件类型
   * @param {number} [options.olderThanDays=7] - 清理天数
   * @returns {Promise<Object>} 操作结果
   */
  async manageTempFiles(action, options = {}) {
    const { type = 'all', olderThanDays = 7 } = options;

    try {
      if (action === 'stats') {
        const stats = await getTempDirStats();
        return {
          success: true,
          action: 'stats',
          data: stats
        };
      } else if (action === 'cleanup') {
        const cleanedCount = await cleanupTempFiles(type, olderThanDays);
        return {
          success: true,
          action: 'cleanup',
          type,
          olderThanDays,
          cleanedFiles: cleanedCount,
          message: `成功清理 ${cleanedCount} 个临时文件`
        };
      } else {
        throw new Error(`不支持的操作类型: ${action}`);
      }
    } catch (error) {
      throw new Error(`临时文件管理失败: ${error.message}`);
    }
  }

  /**
   * 批量上传多个文件到COS，支持智能并发控制和重试
   * @param {Array<Object>} files - 文件数组
   * @param {string} files[].path - 文件本地路径
   * @param {string} [files[].key] - COS中的对象键
   * @param {Object} [options] - 批量上传选项
   * @param {number} [options.concurrency=3] - 并发数量
   * @param {number} [options.maxRetries=3] - 最大重试次数
   * @param {Function} [options.onProgress] - 进度回调
   * @returns {Promise<Array>} 上传结果数组，每个结果包含成功状态和详细信息
   */
  async uploadMultipleFiles(files = [], options = {}) {
    const {
      concurrency = 3,
      maxRetries = 3,
      onProgress = null
    } = options;

    if (!Array.isArray(files) || files.length === 0) {
      throw new Error('文件列表不能为空');
    }

    const results = [];
    const totalFiles = files.length;
    let completedFiles = 0;
    let successCount = 0;
    let failureCount = 0;

    // 并发控制队列
    const executeWithConcurrency = async (fileList, concurrentLimit) => {
      const executing = [];

      for (const file of fileList) {
        const promise = this._uploadSingleFileWithRetry(file, maxRetries)
          .then(result => {
            completedFiles++;
            if (result.success) {
              successCount++;
            } else {
              failureCount++;
            }

            // 触发进度回调
            if (onProgress) {
              onProgress({
                completed: completedFiles,
                total: totalFiles,
                success: successCount,
                failed: failureCount,
                percent: (completedFiles / totalFiles * 100).toFixed(1)
              });
            }

            return result;
          })
          .catch(error => {
            completedFiles++;
            failureCount++;

            if (onProgress) {
              onProgress({
                completed: completedFiles,
                total: totalFiles,
                success: successCount,
                failed: failureCount,
                percent: (completedFiles / totalFiles * 100).toFixed(1)
              });
            }

            return {
              success: false,
              error: error.message,
              originalPath: file.path
            };
          });

        executing.push(promise);

        if (executing.length >= concurrentLimit) {
          await Promise.race(executing);
          // 移除已完成的promise
          const index = executing.findIndex(p => p.resolved);
          if (index !== -1) {
            executing.splice(index, 1);
          }
        }
      }

      return Promise.all(executing);
    };

    try {
      const batchResults = await executeWithConcurrency(files, concurrency);

      // 批量上传完成后，清理可能残留的批量上传临时文件
      try {
        await this._cleanupBatchUploadTempFiles();
      } catch (clearErr) {
        // 清理失败时静默处理，不影响上传结果
      }

      return batchResults.flat();
    } catch (error) {
      // 批量上传发生异常时，也尝试清理临时文件
      try {
        await this._cleanupBatchUploadTempFiles();
      } catch (clearErr) {
        // 清理失败时静默处理
      }
      throw new Error(`批量上传失败: ${error.message}`);
    }
  }

  /**
   * 单文件上传带重试机制
   * @param {Object} file - 文件对象
   * @param {number} maxRetries - 最大重试次数
   * @returns {Promise<Object>} 上传结果
   * @private
   */
  async _uploadSingleFileWithRetry(file, maxRetries = 3) {
    let lastError;
    let retryCount = 0;

    while (retryCount <= maxRetries) {
      try {
        const result = await this.uploadFile(file.path, { key: file.key });
        return { ...result, originalPath: file.path, retries: retryCount };
      } catch (error) {
        lastError = error;
        retryCount++;

        // 检查是否应该重试
        if (retryCount > maxRetries || !this._shouldRetry(error)) {
          break;
        }

        // 指数退避延迟
        const delay = Math.min(1000 * Math.pow(2, retryCount - 1), 30000);
        // 延迟重试 (静默处理)

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw new Error(`文件 ${file.path} 上传失败（重试${retryCount}次）: ${lastError.message}`);
  }

  /**
   * 判断错误是否应该重试
   * @param {Error} error - 错误对象
   * @returns {boolean} 是否应该重试
   * @private
   */
  _shouldRetry(error) {
    const retryableErrors = [
      'ECONNRESET',
      'ETIMEDOUT',
      'ENOTFOUND',
      'ECONNREFUSED',
      'RequestTimeout',
      'ServiceUnavailable',
      'InternalError',
      'SlowDown'
    ];

    const errorMessage = error.message || '';
    return retryableErrors.some(retryableError =>
      errorMessage.includes(retryableError)
    );
  }

  /**
   * 清理批量上传过程中产生的临时文件
   * @returns {Promise<void>}
   * @private
   */
  async _cleanupBatchUploadTempFiles() {
    try {
      // 清理批量上传专用的临时文件
      const batchTempFiles = [
        'batch_upload_queue.json',
        'batch_upload_status.json',
        'batch_upload_errors.json'
      ];

      for (const tempFile of batchTempFiles) {
        try {
          await fs.unlink(path.join(TEMP_DIRS.UPLOADS, tempFile));
        } catch (error) {
          // 文件可能不存在，忽略错误
        }
      }

      // 清理可能的批量上传缓存目录
      const batchCacheDir = path.join(TEMP_DIRS.CACHE, 'batch_uploads');
      try {
        const { readdir, rmdir } = await import('fs/promises');
        const files = await readdir(batchCacheDir);
        for (const file of files) {
          await fs.unlink(path.join(batchCacheDir, file));
        }
        await rmdir(batchCacheDir);
      } catch (error) {
        // 目录可能不存在，忽略错误
      }

      // 清理过期的上传锁文件
      const lockPattern = /^upload_lock_\d+\.lock$/;
      try {
        const { readdir } = await import('fs/promises');
        const files = await readdir(TEMP_DIRS.UPLOADS);
        const currentTime = Date.now();

        for (const file of files) {
          if (lockPattern.test(file)) {
            const filePath = path.join(TEMP_DIRS.UPLOADS, file);
            try {
              const stats = await fs.stat(filePath);
              // 清理超过1小时的锁文件
              if (currentTime - stats.mtime.getTime() > 3600000) {
                await fs.unlink(filePath);
              }
            } catch (error) {
              // 文件可能已被删除，忽略错误
            }
          }
        }
      } catch (error) {
        // 目录访问失败时静默处理
      }
    } catch (error) {
      // 批量清理失败时静默处理
    }
  }

  /**
   * 获取对象的临时签名URL
   * @param {string} key - COS对象键
   * @param {number} [expireTime=3600] - URL有效期（秒），默认1小时
   * @returns {Promise<Object>} 包含临时URL的结果对象
   * @throws {Error} 获取失败时抛出错误
   */
  async getSignedUrl(key, expireTime = 3600) {
    this._checkConfig();
    
    try {
      const params = {
        Bucket: this.config.Bucket,
        Region: this.config.Region,
        Key: key,
        Sign: true,
        Expires: expireTime
      };

      const url = await this.cos.getObjectUrl(params);
      return { success: true, url };
    } catch (error) {
      throw new Error(`获取签名URL失败: ${error.message}`);
    }
  }

  /**
   * 列出存储桶中的对象
   * @param {string} [prefix=''] - 对象键前缀过滤
   * @returns {Promise<Object>} 包含文件列表的结果对象
   * @throws {Error} 列举失败时抛出错误
   */
  async listObjects(prefix = '') {
    this._checkConfig();
    
    try {
      const params = {
        Bucket: this.config.Bucket,
        Region: this.config.Region,
        Prefix: prefix,
        MaxKeys: 1000
      };

      const response = await this.cos.getBucket(params);
      return {
        success: true,
        files: response.Contents || [],
        prefix,
        total: response.Contents?.length || 0
      };
    } catch (error) {
      throw new Error(`列举文件失败: ${error.message}`);
    }
  }

  /**
   * 删除单个对象
   * @param {string} key - 要删除的对象键
   * @returns {Promise<Object>} 删除结果
   * @throws {Error} 删除失败时抛出错误
   */
  async deleteObject(key) {
    this._checkConfig();
    
    try {
      const params = {
        Bucket: this.config.Bucket,
        Region: this.config.Region,
        Key: key
      };

      await this.cos.deleteObject(params);
      return { success: true, key };
    } catch (error) {
      throw new Error(`删除文件失败: ${error.message}`);
    }
  }

  /**
   * 复制COS对象
   * @param {string} sourceKey - 源对象键
   * @param {string} targetKey - 目标对象键
   * @param {Object} [options] - 复制选项
   * @param {string} [options.targetBucket] - 目标存储桶，不指定则为当前存储桶
   * @returns {Promise<Object>} 复制结果，包含新对象的URL和元数据
   * @throws {Error} 复制失败时抛出错误
   */
  async copyObject(sourceKey, targetKey, { targetBucket = null } = {}) {
    this._checkConfig();
    
    try {
      const sourceBucket = targetBucket || this.config.Bucket;
      const params = {
        Bucket: this.config.Bucket,
        Region: this.config.Region,
        Key: targetKey,
        CopySource: `${sourceBucket}.cos.${this.config.Region}.myqcloud.com/${sourceKey}`
      };

      const response = await this.cos.putObjectCopy(params);
      
      // 生成访问URL
      const domain = this.config.Domain || `https://${this.config.Bucket}.cos.${this.config.Region}.myqcloud.com`;
      const fileUrl = `${domain}/${targetKey}`;

      return {
        success: true,
        sourceKey,
        targetKey,
        url: fileUrl,
        etag: response.ETag,
        lastModified: response.LastModified
      };
    } catch (error) {
      throw new Error(`复制文件失败: ${error.message}`);
    }
  }

  /**
   * 移动COS对象（复制+删除原文件）
   * @param {string} sourceKey - 源对象键
   * @param {string} targetKey - 目标对象键
   * @param {Object} [options] - 移动选项
   * @param {string} [options.targetBucket] - 目标存储桶，不指定则为当前存储桶
   * @returns {Promise<Object>} 移动结果，包含新对象的URL和元数据
   * @throws {Error} 移动失败时抛出错误
   */
  async moveObject(sourceKey, targetKey, { targetBucket = null } = {}) {
    this._checkConfig();
    
    try {
      // 先复制文件
      const copyResult = await this.copyObject(sourceKey, targetKey, { targetBucket });
      
      // 复制成功后删除源文件
      await this.deleteObject(sourceKey);
      
      return {
        success: true,
        sourceKey,
        targetKey,
        url: copyResult.url,
        etag: copyResult.etag,
        operation: 'move'
      };
    } catch (error) {
      throw new Error(`移动文件失败: ${error.message}`);
    }
  }

  /**
   * 重命名COS对象（基于移动操作实现）
   * @param {string} oldKey - 原对象键
   * @param {string} newKey - 新对象键
   * @returns {Promise<Object>} 重命名结果
   * @throws {Error} 重命名失败时抛出错误
   */
  async renameObject(oldKey, newKey) {
    this._checkConfig();
    
    try {
      // 重命名实际上是移动操作
      const result = await this.moveObject(oldKey, newKey);
      
      return {
        success: true,
        oldKey,
        newKey,
        url: result.url,
        etag: result.etag,
        operation: 'rename'
      };
    } catch (error) {
      throw new Error(`重命名文件失败: ${error.message}`);
    }
  }

  /**
   * 批量删除多个COS对象
   * @param {Array<string>} keys - 要删除的对象键数组
   * @returns {Promise<Object>} 批量删除结果，包含成功和失败的对象列表
   * @throws {Error} 批量删除失败时抛出错误
   */
  async deleteMultipleObjects(keys = []) {
    this._checkConfig();
    
    if (!Array.isArray(keys) || keys.length === 0) {
      throw new Error('键列表不能为空');
    }

    try {
      const params = {
        Bucket: this.config.Bucket,
        Region: this.config.Region,
        Delete: {
          Objects: keys.map(key => ({ Key: key })),
          Quiet: false
        }
      };

      const response = await this.cos.deleteMultipleObject(params);
      
      return {
        success: true,
        deleted: response.Deleted || [],
        errors: response.Error || [],
        total: keys.length
      };
    } catch (error) {
      throw new Error(`批量删除文件失败: ${error.message}`);
    }
  }

  /**
   * 创建文件夹（在COS中创建以"/"结尾的空对象）
   * @param {string} folderPath - 文件夹路径
   * @returns {Promise<Object>} 创建结果
   * @throws {Error} 创建失败时抛出错误
   */
  async createFolder(folderPath) {
    this._checkConfig();
    
    try {
      // 确保文件夹路径以/结尾
      const folderKey = folderPath.endsWith('/') ? folderPath : `${folderPath}/`;
      
      const params = {
        Bucket: this.config.Bucket,
        Region: this.config.Region,
        Key: folderKey,
        Body: ''
      };

      await this.cos.putObject(params);
      
      return {
        success: true,
        folderPath: folderKey,
        operation: 'create_folder'
      };
    } catch (error) {
      throw new Error(`创建文件夹失败: ${error.message}`);
    }
  }

  /**
   * 删除文件夹
   * @param {string} folderPath - 文件夹路径
   * @param {Object} [options] - 删除选项
   * @param {boolean} [options.recursive=false] - 是否递归删除文件夹内的所有内容
   * @returns {Promise<Object>} 删除结果
   * @throws {Error} 删除失败时抛出错误
   */
  async deleteFolder(folderPath, { recursive = false } = {}) {
    this._checkConfig();
    
    try {
      // 确保文件夹路径以/结尾
      const folderKey = folderPath.endsWith('/') ? folderPath : `${folderPath}/`;
      
      if (recursive) {
        // 递归删除：先列出文件夹中的所有对象
        const listResult = await this.listObjects(folderKey);
        
        if (listResult.files && listResult.files.length > 0) {
          const keys = listResult.files.map(file => file.Key);
          await this.deleteMultipleObjects(keys);
        }
        
        // 删除文件夹本身
        await this.deleteObject(folderKey);
        
        return {
          success: true,
          folderPath: folderKey,
          deletedCount: listResult.files ? listResult.files.length + 1 : 1,
          operation: 'delete_folder_recursive'
        };
      } else {
        // 非递归删除：只删除空文件夹
        await this.deleteObject(folderKey);
        
        return {
          success: true,
          folderPath: folderKey,
          operation: 'delete_folder'
        };
      }
    } catch (error) {
      throw new Error(`删除文件夹失败: ${error.message}`);
    }
  }

  /**
   * 以文件夹视图列出COS内容，区分文件夹和文件
   * @param {string} [prefix=''] - 路径前缀
   * @returns {Promise<Object>} 包含文件夹和文件列表的结果
   * @throws {Error} 列举失败时抛出错误
   */
  async listFolders(prefix = '') {
    this._checkConfig();
    
    try {
      const params = {
        Bucket: this.config.Bucket,
        Region: this.config.Region,
        Prefix: prefix,
        Delimiter: '/',
        MaxKeys: 1000
      };

      const response = await this.cos.getBucket(params);
      
      return {
        success: true,
        folders: response.CommonPrefixes?.map(item => item.Prefix) || [],
        files: response.Contents?.filter(item => !item.Key.endsWith('/')) || [],
        prefix,
        total: (response.CommonPrefixes?.length || 0) + (response.Contents?.length || 0)
      };
    } catch (error) {
      throw new Error(`列举文件夹失败: ${error.message}`);
    }
  }

  /**
   * 获取文件夹统计信息，包括文件数量、总大小、文件类型分布等
   * @param {string} [folderPath] - 文件夹路径，为空则统计整个存储桶
   * @returns {Promise<Object>} 包含详细统计信息的结果
   * @throws {Error} 获取统计失败时抛出错误
   */
  async getFolderStats(folderPath) {
    this._checkConfig();
    
    try {
      // 确保文件夹路径以/结尾
      const folderKey = folderPath ? (folderPath.endsWith('/') ? folderPath : `${folderPath}/`) : '';
      
      const listResult = await this.listObjects(folderKey);
      
      let totalSize = 0;
      let fileCount = 0;
      const fileTypes = {};
      
      if (listResult.files) {
        for (const file of listResult.files) {
          if (!file.Key.endsWith('/')) { // 排除文件夹对象
            fileCount++;
            totalSize += file.Size || 0;
            
            // 统计文件类型
            const ext = file.Key.split('.').pop()?.toLowerCase() || 'unknown';
            fileTypes[ext] = (fileTypes[ext] || 0) + 1;
          }
        }
      }
      
      return {
        success: true,
        folderPath: folderKey,
        fileCount,
        totalSize,
        totalSizeFormatted: this._formatFileSize(totalSize),
        fileTypes,
        averageFileSize: fileCount > 0 ? Math.round(totalSize / fileCount) : 0
      };
    } catch (error) {
      throw new Error(`获取文件夹统计失败: ${error.message}`);
    }
  }

  /**
   * 格式化文件大小为人类可读的字符串
   * @param {number} bytes - 字节数
   * @returns {string} 格式化后的大小字符串（如"1.5 MB"）
   * @private
   */
  _formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

export const cosService = new TencentCOSService();