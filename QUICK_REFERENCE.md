# TX-COS-MCP 快速参考

## 🚀 工具快速索引

| 工具名称 | 功能 | 必需参数 | 可选参数 |
|---------|------|---------|---------|
| `upload_file` | 单文件上传 | `file_path` | `object_key`, `custom_domain` |
| `upload_multiple` | 批量上传 | `files[]` | - |
| `copy_object` | 复制对象 | `source_key`, `target_key` | `target_bucket` |
| `move_object` | 移动对象 | `source_key`, `target_key` | `target_bucket` |
| `rename_object` | 重命名对象 | `old_key`, `new_key` | - |
| `delete_object` | 删除对象 | `object_key` | - |
| `delete_multiple` | 批量删除 | `object_keys[]` | - |
| `create_folder` | 创建文件夹 | `folder_path` | - |
| `delete_folder` | 删除文件夹 | `folder_path` | `recursive` |
| `list_objects` | 列出对象 | - | `prefix` |
| `list_folders` | 列出文件夹 | - | `prefix` |
| `get_folder_stats` | 文件夹统计 | - | `folder_path` |
| `get_signed_url` | 临时URL | `object_key` | `expire_time` |

## 📝 常用示例

### 文件上传
```json
// 单文件上传
{"file_path": "/path/to/file.jpg", "object_key": "images/file.jpg"}

// 批量上传
{"files": [{"file_path": "/path/file1.jpg"}, {"file_path": "/path/file2.jpg"}]}
```

### 文件操作
```json
// 复制文件
{"source_key": "images/old.jpg", "target_key": "backup/old.jpg"}

// 移动文件
{"source_key": "temp/file.jpg", "target_key": "images/file.jpg"}

// 重命名文件
{"old_key": "IMG_001.jpg", "new_key": "sunset.jpg"}
```

### 删除操作
```json
// 删除单个文件
{"object_key": "temp/file.jpg"}

// 批量删除
{"object_keys": ["temp/file1.jpg", "temp/file2.jpg"]}
```

### 文件夹操作
```json
// 创建文件夹
{"folder_path": "images/2024"}

// 删除文件夹（递归）
{"folder_path": "old_data", "recursive": true}
```

### 查询操作
```json
// 列出文件
{"prefix": "images/"}

// 文件夹统计
{"folder_path": "images"}

// 生成临时URL（1小时）
{"object_key": "private/file.pdf", "expire_time": 3600}
```

## ⚡ 快速启动

### 1. 安装使用
```bash
npx -y tx-cos-mcp@latest
```

### 2. 环境配置
```bash
export COS_SECRET_ID="your-secret-id"
export COS_SECRET_KEY="your-secret-key"
export COS_REGION="ap-beijing"
export COS_BUCKET="your-bucket"
```

### 3. MCP配置
```json
{
  "command": "npx",
  "args": ["-y", "tx-cos-mcp@latest"],
  "env": {
    "COS_SECRET_ID": "your-secret-id",
    "COS_SECRET_KEY": "your-secret-key",
    "COS_REGION": "your-region",
    "COS_BUCKET": "your-bucket"
  },
  "transportType": "stdio"
}
```

## 🔄 工作流示例

### 网站部署流程
1. `upload_multiple` - 批量上传网站文件
2. `create_folder` - 创建backup文件夹
3. `copy_object` - 备份重要文件
4. `delete_multiple` - 清理临时文件

### 文件整理流程
1. `list_folders` - 查看目录结构
2. `get_folder_stats` - 分析存储使用
3. `move_object` - 移动文件到正确位置
4. `rename_object` - 标准化文件命名
5. `delete_folder` - 清理空文件夹

### 备份管理流程
1. `create_folder` - 创建日期备份文件夹
2. `copy_object` - 复制文件到备份位置
3. `get_folder_stats` - 检查备份大小
4. `delete_multiple` - 清理过期备份

## 🎯 最佳实践

### 路径命名
- ✅ `images/2024/photo.jpg`
- ✅ `documents/reports/2024-q1.pdf`
- ❌ `/images/photo.jpg` (不要以/开头)
- ❌ `图片/照片.jpg` (避免中文)

### 批量操作
- 每次批量操作建议不超过100个对象
- 大文件上传建议使用单独的upload_file
- 定期检查操作结果中的错误信息

### 权限管理
- 上传操作需要写权限
- 删除操作需要删除权限
- URL签名需要签名权限
- 建议使用最小权限原则

### 错误处理
```json
// 成功响应
{"success": true, "data": {...}}

// 错误响应
{"success": false, "error": "错误描述"}
```

## 📊 返回数据结构

### 文件信息
```json
{
  "Key": "images/photo.jpg",
  "Size": 2048,
  "LastModified": "2024-01-01T12:00:00.000Z",
  "ETag": "\"abc123\"",
  "StorageClass": "STANDARD"
}
```

### 统计信息
```json
{
  "fileCount": 156,
  "totalSize": 52428800,
  "totalSizeFormatted": "50.00 MB",
  "fileTypes": {"jpg": 89, "png": 45},
  "averageFileSize": 336338
}
```

---

📖 **详细文档**: 查看 [TOOLS_USAGE.md](./TOOLS_USAGE.md) 获取完整的使用说明