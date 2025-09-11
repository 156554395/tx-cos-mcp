# TX-COS-MCP 工具使用说明

本文档详细介绍tx-cos-mcp所有MCP工具的使用方法、参数说明和使用示例。

## 📋 工具目录

1. [文件上传工具](#文件上传工具)
   - [upload_file](#1-upload_file---单文件上传)
   - [upload_multiple](#2-upload_multiple---批量文件上传)

2. [文件操作工具](#文件操作工具)
   - [copy_object](#3-copy_object---复制对象)
   - [move_object](#4-move_object---移动对象)
   - [rename_object](#5-rename_object---重命名对象)

3. [删除工具](#删除工具)
   - [delete_object](#6-delete_object---删除对象)
   - [delete_multiple](#7-delete_multiple---批量删除对象)

4. [文件夹管理工具](#文件夹管理工具)
   - [create_folder](#8-create_folder---创建文件夹)
   - [delete_folder](#9-delete_folder---删除文件夹)

5. [列表和查询工具](#列表和查询工具)
   - [list_objects](#10-list_objects---列出存储桶对象)
   - [list_folders](#11-list_folders---列出文件夹和文件)
   - [get_folder_stats](#12-get_folder_stats---获取文件夹统计)

6. [URL工具](#url工具)
   - [get_signed_url](#13-get_signed_url---获取临时访问url)

---

## 文件上传工具

### 1. upload_file - 单文件上传

**功能**: 将本地文件上传到腾讯云COS存储桶

**参数**:
- `file_path` (必需): 本地文件的绝对路径
- `object_key` (可选): 上传后在COS中的对象键名，不提供则使用文件名
- `custom_domain` (可选): 自定义访问域名

**使用示例**:

```javascript
// 基础上传 - 使用文件名作为对象键
{
  "file_path": "/Users/username/Documents/photo.jpg"
}

// 指定对象键的上传
{
  "file_path": "/Users/username/Documents/photo.jpg",
  "object_key": "images/2024/photo.jpg"
}

// 使用自定义域名
{
  "file_path": "/Users/username/Documents/photo.jpg",
  "object_key": "images/photo.jpg",
  "custom_domain": "https://cdn.example.com"
}
```

**返回结果**:
```json
{
  "success": true,
  "data": {
    "success": true,
    "url": "https://bucket.cos.region.myqcloud.com/images/photo.jpg",
    "key": "images/photo.jpg",
    "etag": "\"d41d8cd98f00b204e9800998ecf8427e\"",
    "location": "bucket.cos.region.myqcloud.com/images/photo.jpg",
    "size": 2048
  }
}
```

**适用场景**:
- 上传单个文件到COS
- 需要指定特定的存储路径
- 使用CDN加速域名访问

---

### 2. upload_multiple - 批量文件上传

**功能**: 一次性上传多个本地文件到COS

**参数**:
- `files` (必需): 文件数组，每个文件包含:
  - `file_path` (必需): 本地文件路径
  - `object_key` (可选): COS中的对象键

**使用示例**:

```javascript
// 批量上传多个文件
{
  "files": [
    {
      "file_path": "/Users/username/Documents/photo1.jpg",
      "object_key": "images/photo1.jpg"
    },
    {
      "file_path": "/Users/username/Documents/photo2.jpg",
      "object_key": "images/photo2.jpg"
    },
    {
      "file_path": "/Users/username/Documents/document.pdf"
      // 不指定object_key，将使用文件名 "document.pdf"
    }
  ]
}
```

**返回结果**:
```json
{
  "success": true,
  "data": [
    {
      "success": true,
      "url": "https://bucket.cos.region.myqcloud.com/images/photo1.jpg",
      "key": "images/photo1.jpg",
      "etag": "\"abc123\"",
      "originalPath": "/Users/username/Documents/photo1.jpg"
    },
    {
      "success": false,
      "error": "文件不存在",
      "originalPath": "/Users/username/Documents/photo2.jpg"
    }
  ]
}
```

**适用场景**:
- 批量上传多个文件
- 网站资源批量部署
- 数据迁移场景

---

## 文件操作工具

### 3. copy_object - 复制对象

**功能**: 在COS中复制对象，支持同存储桶内复制或跨存储桶复制

**参数**:
- `source_key` (必需): 源对象的键名
- `target_key` (必需): 目标对象的键名
- `target_bucket` (可选): 目标存储桶名，不指定则为当前存储桶

**使用示例**:

```javascript
// 同存储桶内复制
{
  "source_key": "images/original.jpg",
  "target_key": "images/backup/original.jpg"
}

// 跨存储桶复制
{
  "source_key": "images/photo.jpg",
  "target_key": "photos/photo.jpg",
  "target_bucket": "backup-bucket-1234567890"
}

// 复制并重命名
{
  "source_key": "temp/upload.jpg",
  "target_key": "images/final_image.jpg"
}
```

**返回结果**:
```json
{
  "success": true,
  "data": {
    "success": true,
    "sourceKey": "images/original.jpg",
    "targetKey": "images/backup/original.jpg",
    "url": "https://bucket.cos.region.myqcloud.com/images/backup/original.jpg",
    "etag": "\"d41d8cd98f00b204e9800998ecf8427e\"",
    "lastModified": "2024-01-01T12:00:00.000Z"
  }
}
```

**适用场景**:
- 文件备份
- 数据迁移
- 创建文件副本

---

### 4. move_object - 移动对象

**功能**: 移动COS中的对象到新位置（复制+删除原文件）

**参数**:
- `source_key` (必需): 源对象的键名
- `target_key` (必需): 目标对象的键名
- `target_bucket` (可选): 目标存储桶名

**使用示例**:

```javascript
// 移动文件到新文件夹
{
  "source_key": "temp/uploaded_file.jpg",
  "target_key": "images/processed_file.jpg"
}

// 跨存储桶移动
{
  "source_key": "images/photo.jpg",
  "target_key": "archive/photo.jpg",
  "target_bucket": "archive-bucket-1234567890"
}
```

**返回结果**:
```json
{
  "success": true,
  "data": {
    "success": true,
    "sourceKey": "temp/uploaded_file.jpg",
    "targetKey": "images/processed_file.jpg",
    "url": "https://bucket.cos.region.myqcloud.com/images/processed_file.jpg",
    "etag": "\"abc123def456\"",
    "operation": "move"
  }
}
```

**适用场景**:
- 文件整理和归档
- 工作流中的文件状态变更
- 临时文件转为正式文件

---

### 5. rename_object - 重命名对象

**功能**: 重命名COS中的对象（基于移动操作实现）

**参数**:
- `old_key` (必需): 原对象的键名
- `new_key` (必需): 新对象的键名

**使用示例**:

```javascript
// 简单重命名
{
  "old_key": "images/IMG_001.jpg",
  "new_key": "images/sunset_beach.jpg"
}

// 重命名并移动到新目录
{
  "old_key": "uploads/temp_file.pdf",
  "new_key": "documents/final_report.pdf"
}

// 批量重命名的一部分
{
  "old_key": "photos/DSC_001.jpg",
  "new_key": "photos/2024_vacation_001.jpg"
}
```

**返回结果**:
```json
{
  "success": true,
  "data": {
    "success": true,
    "oldKey": "images/IMG_001.jpg",
    "newKey": "images/sunset_beach.jpg",
    "url": "https://bucket.cos.region.myqcloud.com/images/sunset_beach.jpg",
    "etag": "\"abc123def456\"",
    "operation": "rename"
  }
}
```

**适用场景**:
- 文件重命名整理
- 统一命名规范
- 文件标识优化

---

## 删除工具

### 6. delete_object - 删除对象

**功能**: 删除COS中的单个对象

**参数**:
- `object_key` (必需): 要删除的对象键名

**使用示例**:

```javascript
// 删除单个文件
{
  "object_key": "images/old_photo.jpg"
}

// 删除临时文件
{
  "object_key": "temp/processing_file.tmp"
}

// 删除文档
{
  "object_key": "documents/outdated_report.pdf"
}
```

**返回结果**:
```json
{
  "success": true,
  "data": {
    "success": true,
    "key": "images/old_photo.jpg"
  }
}
```

**适用场景**:
- 清理不需要的文件
- 删除临时文件
- 存储空间管理

---

### 7. delete_multiple - 批量删除对象

**功能**: 一次性删除多个COS对象

**参数**:
- `object_keys` (必需): 要删除的对象键名数组

**使用示例**:

```javascript
// 批量删除多个文件
{
  "object_keys": [
    "temp/file1.jpg",
    "temp/file2.jpg",
    "temp/file3.pdf",
    "cache/data.json"
  ]
}

// 清空某个目录的文件（需要先列出）
{
  "object_keys": [
    "logs/2023-01-01.log",
    "logs/2023-01-02.log",
    "logs/2023-01-03.log"
  ]
}
```

**返回结果**:
```json
{
  "success": true,
  "data": {
    "success": true,
    "deleted": [
      {
        "Key": "temp/file1.jpg"
      },
      {
        "Key": "temp/file2.jpg"
      }
    ],
    "errors": [
      {
        "Key": "temp/file3.pdf",
        "Code": "NoSuchKey",
        "Message": "The specified key does not exist."
      }
    ],
    "total": 4
  }
}
```

**适用场景**:
- 批量清理临时文件
- 定期删除过期数据
- 存储空间优化

---

## 文件夹管理工具

### 8. create_folder - 创建文件夹

**功能**: 在COS中创建文件夹结构

**参数**:
- `folder_path` (必需): 文件夹路径

**使用示例**:

```javascript
// 创建简单文件夹
{
  "folder_path": "images"
}

// 创建多级文件夹
{
  "folder_path": "projects/website/assets/images"
}

// 创建日期文件夹
{
  "folder_path": "backups/2024/01"
}
```

**返回结果**:
```json
{
  "success": true,
  "data": {
    "success": true,
    "folderPath": "projects/website/assets/images/",
    "operation": "create_folder"
  }
}
```

**适用场景**:
- 组织文件结构
- 创建项目目录
- 建立分类体系

---

### 9. delete_folder - 删除文件夹

**功能**: 删除COS中的文件夹，支持递归删除

**参数**:
- `folder_path` (必需): 文件夹路径
- `recursive` (可选): 是否递归删除，默认false

**使用示例**:

```javascript
// 删除空文件夹
{
  "folder_path": "temp"
}

// 递归删除文件夹及其所有内容
{
  "folder_path": "old_project",
  "recursive": true
}

// 删除特定日期的备份文件夹
{
  "folder_path": "backups/2023/12",
  "recursive": true
}
```

**返回结果**:

```json
// 非递归删除
{
  "success": true,
  "data": {
    "success": true,
    "folderPath": "temp/",
    "operation": "delete_folder"
  }
}

// 递归删除
{
  "success": true,
  "data": {
    "success": true,
    "folderPath": "old_project/",
    "deletedCount": 15,
    "operation": "delete_folder_recursive"
  }
}
```

**适用场景**:
- 清理项目目录
- 删除过期备份
- 存储空间整理

---

## 列表和查询工具

### 10. list_objects - 列出存储桶对象

**功能**: 列出存储桶中的对象，支持前缀过滤

**参数**:
- `prefix` (可选): 对象键的过滤前缀

**使用示例**:

```javascript
// 列出所有对象
{
}

// 列出特定目录下的对象
{
  "prefix": "images/"
}

// 列出特定文件类型
{
  "prefix": "documents/pdf"
}

// 列出日期目录
{
  "prefix": "logs/2024/01/"
}
```

**返回结果**:
```json
{
  "success": true,
  "data": {
    "success": true,
    "files": [
      {
        "Key": "images/photo1.jpg",
        "LastModified": "2024-01-01T12:00:00.000Z",
        "ETag": "\"abc123\"",
        "Size": 2048,
        "StorageClass": "STANDARD"
      },
      {
        "Key": "images/photo2.jpg",
        "LastModified": "2024-01-02T12:00:00.000Z",
        "ETag": "\"def456\"",
        "Size": 3072,
        "StorageClass": "STANDARD"
      }
    ],
    "prefix": "images/",
    "total": 2
  }
}
```

**适用场景**:
- 浏览存储桶内容
- 文件清单管理
- 存储分析

---

### 11. list_folders - 列出文件夹和文件

**功能**: 以文件夹视图列出COS中的内容，区分文件夹和文件

**参数**:
- `prefix` (可选): 路径前缀，默认为根目录

**使用示例**:

```javascript
// 列出根目录
{
}

// 列出特定目录下的内容
{
  "prefix": "projects/"
}

// 浏览多级目录
{
  "prefix": "assets/images/"
}
```

**返回结果**:
```json
{
  "success": true,
  "data": {
    "success": true,
    "folders": [
      "projects/website/",
      "projects/mobile/",
      "projects/docs/"
    ],
    "files": [
      {
        "Key": "projects/README.md",
        "LastModified": "2024-01-01T12:00:00.000Z",
        "Size": 1024
      }
    ],
    "prefix": "projects/",
    "total": 4
  }
}
```

**适用场景**:
- 文件夹浏览器界面
- 目录结构展示
- 层级导航

---

### 12. get_folder_stats - 获取文件夹统计

**功能**: 获取文件夹的详细统计信息，包括大小、数量、类型分布等

**参数**:
- `folder_path` (可选): 文件夹路径，为空则统计整个存储桶

**使用示例**:

```javascript
// 统计整个存储桶
{
}

// 统计特定文件夹
{
  "folder_path": "images"
}

// 统计多级文件夹
{
  "folder_path": "projects/website/assets"
}
```

**返回结果**:
```json
{
  "success": true,
  "data": {
    "success": true,
    "folderPath": "images/",
    "fileCount": 156,
    "totalSize": 52428800,
    "totalSizeFormatted": "50.00 MB",
    "fileTypes": {
      "jpg": 89,
      "png": 45,
      "gif": 12,
      "svg": 10
    },
    "averageFileSize": 336338
  }
}
```

**适用场景**:
- 存储使用分析
- 容量规划
- 文件类型统计
- 成本计算

---

## URL工具

### 13. get_signed_url - 获取临时访问URL

**功能**: 为COS对象生成带签名的临时访问URL

**参数**:
- `object_key` (必需): COS对象的键名
- `expire_time` (可选): URL有效期（秒），默认3600秒（1小时）

**使用示例**:

```javascript
// 生成1小时有效期的URL（默认）
{
  "object_key": "documents/private_report.pdf"
}

// 生成自定义有效期的URL（24小时）
{
  "object_key": "images/private_photo.jpg",
  "expire_time": 86400
}

// 生成短期URL（5分钟）
{
  "object_key": "temp/download_file.zip",
  "expire_time": 300
}
```

**返回结果**:
```json
{
  "success": true,
  "data": {
    "success": true,
    "url": "https://bucket.cos.region.myqcloud.com/documents/private_report.pdf?sign=xxxx&t=1704067200&e=1704070800"
  }
}
```

**适用场景**:
- 私有文件临时分享
- 下载链接生成
- 安全文件访问
- 时效性内容分发

---

## 🔧 使用技巧

### 错误处理
所有工具都会返回统一的错误格式：
```json
{
  "success": false,
  "error": "错误描述信息"
}
```

### 批量操作最佳实践
- 批量操作建议每次不超过100个对象
- 大量文件操作建议分批进行
- 注意监控操作结果中的错误信息

### 路径规范
- 对象键不需要以"/"开头
- 文件夹路径建议以"/"结尾
- 避免使用特殊字符和中文字符

### 权限要求
确保配置的COS密钥具有相应的操作权限：
- 读权限：list_objects, list_folders, get_folder_stats
- 写权限：upload_file, upload_multiple, create_folder, copy_object
- 删权限：delete_object, delete_multiple, delete_folder, move_object, rename_object
- URL签名权限：get_signed_url

---

## 📞 支持

如果在使用过程中遇到问题，请查看：
- [GitHub Issues](https://github.com/156554395/tx-cos-mcp/issues)
- [项目文档](https://github.com/156554395/tx-cos-mcp#readme)
- [腾讯云COS文档](https://cloud.tencent.com/document/product/436)