import COS from 'cos-nodejs-sdk-v5';
import path from 'path';
import fs from 'fs/promises';
import { cosConfig, hasValidConfig } from './config.js';

class TencentCOSService {
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

  _checkConfig() {
    if (!this.configValid) {
      throw new Error('COS配置无效，请检查环境变量设置');
    }
  }

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

  _formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

export const cosService = new TencentCOSService();