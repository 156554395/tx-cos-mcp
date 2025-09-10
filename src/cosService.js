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
}

export const cosService = new TencentCOSService();