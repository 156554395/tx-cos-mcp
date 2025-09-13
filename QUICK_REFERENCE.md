# TX-COS-MCP 快速参考

## 🚀 工具快速索引

| 工具名称 | 功能 | 必需参数 | 可选参数 |
|---------|------|---------|---------|
| `upload_file` | 单文件上传 | `file_path` | `object_key`, `custom_domain` |
| `upload_multiple` | 批量上传 | `files[]` | `concurrency`, `max_retries` |
| `upload_large_file` | 大文件分片上传 | `file_path` | `object_key`, `custom_domain`, `chunk_size`, `concurrency`, `force_slice` |
| `get_upload_progress` | 获取上传进度 | - | `session_id` |
| `clear_upload_progress` | 清理上传进度 | `session_id` | - |
| `manage_temp_files` | 管理临时文件 | `action` | `type`, `older_than_days` |
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


## 实用提示词示例

### 文件上传相关：

- 请帮我上传这个文件到COS：/path/to/myfile.jpg
- 批量上传这几个文件到examples文件夹：file1.txt, file2.pdf, file3.png
- 上传文件并指定对象键名为photos/2024/avatar.jpg
- 将img目录下的文件全部上传到cos

### 文件访问相关：

- 获取文件document.pdf的临时下载链接，有效期1小时
- 为图片image.jpg生成30分钟有效的分享链接

### 文件管理相关：

- 列出COS中所有在uploads/文件夹下的文件
- 删除旧版本的backup/data.json文件
- 查看当前COS存储桶中有哪些文件

### 实际业务场景：

- 上传项目构建后的dist文件夹内容到static目录
- 为用户头像生成临时访问链接用于前端显示
- 清理test/目录下的所有测试文件
- 获取COS中images/文件夹下的所有图片

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