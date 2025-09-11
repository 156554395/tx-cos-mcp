import COS from 'cos-nodejs-sdk-v5';
import path from 'path';
import fs from 'fs/promises';
import { cosConfig, hasValidConfig } from './config.js';

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
   * @returns {Promise<Object>} 上传结果，包含URL、键名、ETag等信息
   * @throws {Error} 上传失败时抛出错误
   */
  async uploadFile(localPath, { key = null, customDomain = null } = {}) {
    this._checkConfig();
    
    try {
      // 读取文件
      const buffer = await fs.readFile(localPath);
      
      // 生成key，如果没提供则使用文件名
      const objectKey = key || path.basename(localPath);
      
      const params = {
        Bucket: this.config.Bucket,
        Region: this.config.Region,
        Key: objectKey,
        Body: buffer,
      };

      // 上传文件
      const response = await this.cos.putObject(params);
      
      // 生成访问URL
      const domain = customDomain || this.config.Domain || `https://${this.config.Bucket}.cos.${this.config.Region}.myqcloud.com`;
      const fileUrl = `${domain}/${objectKey}`;

      return {
        success: true,
        url: fileUrl,
        key: objectKey,
        etag: response.ETag,
        location: response.Location,
        size: buffer.length
      };
    } catch (error) {
      console.error('上传失败:', error);
      throw new Error(`文件上传失败: ${error.message}`);
    }
  }

  /**
   * 批量上传多个文件到COS
   * @param {Array<Object>} files - 文件数组
   * @param {string} files[].path - 文件本地路径
   * @param {string} [files[].key] - COS中的对象键
   * @returns {Promise<Array>} 上传结果数组，每个结果包含成功状态和详细信息
   */
  async uploadMultipleFiles(files = []) {
    const results = [];
    
    for (const file of files) {
      try {
        const result = await this.uploadFile(file.path, { key: file.key });
        results.push({ ...result, originalPath: file.path });
      } catch (error) {
        results.push({
          success: false,
          error: error.message,
          originalPath: file.path
        });
      }
    }
    
    return results;
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