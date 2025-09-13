# 腾讯云 COS MCP 服务器

一个基于 Node.js 的 Model Context Protocol (MCP)服务器，为 Claude Desktop、Cursor 和 Windsurf 等 IDE 提供腾讯云对象存储(COS)功能。

## 功能特性

- 🚀 **文件上传** - 支持单文件和批量文件上传到腾讯云 COS
- 📦 **大文件上传** - 自动分片上传，支持断点续传和进度监控
- 🔄 **并发控制** - 智能重试机制和可配置并发限制
- 🧹 **资源清理** - 自动清理临时文件，防止磁盘空间泄漏
- 📁 **文件管理** - 复制、移动、重命名文件操作
- 🗂️ **文件夹操作** - 创建、删除文件夹，支持递归操作
- 🔗 **临时 URL** - 生成带签名的临时访问链接，支持自定义过期时间
- 📋 **对象管理** - 列出存储桶中的对象，支持前缀过滤和文件夹视图
- 🗑️ **批量删除** - 支持单个和批量删除 COS 中的对象
- 📊 **统计分析** - 文件夹统计信息，包括大小、数量、类型分布
- 🔧 **MCP 兼容** - 完全兼容 Model Context Protocol 规范

## 快速开始

📖 **快速上手**: 查看 [快速参考指南](./QUICK_REFERENCE.md) 了解所有工具的基本用法

📚 **详细文档**: 查看 [工具使用说明](./TOOLS_USAGE.md) 获取完整的API文档和示例

### 本地调试

```bash
# 克隆项目
git clone https://github.com/156554395/tx-cos-mcp.git
cd tx-cos-mcp

# 安装依赖
pnpm install

# 配置环境变量
export COS_SECRET_ID=your-secret-id
export COS_SECRET_KEY=your-secret-key
export COS_REGION=your-region
export COS_BUCKET=your-bucket
export COS_DOMAIN=your-custom-domain.com

# 启动调试服务器
pnpm inspector
```

## 环境配置

服务器通过环境变量读取腾讯云 COS 配置：

### 作为 MCP 服务器使用（推荐）

在 MCP 兼容编辑器中配置：

```json
{
  "command": "npx",
  "args": ["-y", "tx-cos-mcp@latest"],
  "env": {
    "COS_SECRET_ID": "your-secret-id",
    "COS_SECRET_KEY": "your-secret-key",
    "COS_REGION": "your-region",
    "COS_BUCKET": "your-bucket",
    "COS_DOMAIN": "your-custom-domain.com"
  },
  "transportType": "stdio"
}
```

### 环境变量说明

| 变量名           | 必需 | 说明              | 示例                        |
| ---------------- | ---- | ----------------- | --------------------------- |
| `COS_SECRET_ID`  | ✅   | 腾讯云 Secret ID  | `AKIDxxx...`                |
| `COS_SECRET_KEY` | ✅   | 腾讯云 Secret Key | `xxx...`                    |
| `COS_REGION`     | ✅   | COS 地域          | `ap-beijing`, `ap-shanghai` |
| `COS_BUCKET`     | ✅   | 存储桶名称        | `my-bucket-1234567890`      |
| `COS_DOMAIN`     | ❌   | 自定义域名        | `cdn.example.com`           |

## MCP 工具列表

### 1. upload_file - 单文件上传

```javascript
{
  "file_path": "/path/to/local/file.jpg",    // 必需：本地文件路径
  "object_key": "images/file.jpg",           // 可选：COS中的对象键
  "custom_domain": "cdn.example.com"        // 可选：自定义域名
}
```

### 2. upload_multiple - 批量文件上传

```javascript
{
  "files": [
    {
      "file_path": "/path/to/file1.jpg",
      "object_key": "images/file1.jpg"       // 可选
    },
    {
      "file_path": "/path/to/file2.png"      // 使用文件名作为对象键
    }
  ]
}
```

### 3. get_signed_url - 获取临时访问 URL

```javascript
{
  "object_key": "images/file.jpg",          // 必需：COS对象键
  "expire_time": 3600                       // 可选：过期时间(秒)，默认1小时
}
```

### 4. list_objects - 列出存储桶对象

```javascript
{
  "prefix": "images/"                       // 可选：对象键前缀过滤
}
```

### 5. delete_object - 删除对象

```javascript
{
  "object_key": "images/file.jpg"           // 必需：要删除的对象键
}
```

### 6. copy_object - 复制对象

```javascript
{
  "source_key": "images/file.jpg",          // 必需：源对象键
  "target_key": "backup/file.jpg",          // 必需：目标对象键
  "target_bucket": "other-bucket"           // 可选：目标存储桶
}
```

### 7. move_object - 移动对象

```javascript
{
  "source_key": "temp/file.jpg",            // 必需：源对象键
  "target_key": "images/file.jpg",          // 必需：目标对象键
  "target_bucket": "other-bucket"           // 可选：目标存储桶
}
```

### 8. rename_object - 重命名对象

```javascript
{
  "old_key": "images/old_name.jpg",         // 必需：原对象键
  "new_key": "images/new_name.jpg"          // 必需：新对象键
}
```

### 9. delete_multiple - 批量删除对象

```javascript
{
  "object_keys": [                          // 必需：对象键数组
    "images/file1.jpg",
    "images/file2.jpg",
    "temp/file3.png"
  ]
}
```

### 10. create_folder - 创建文件夹

```javascript
{
  "folder_path": "images/thumbnails"        // 必需：文件夹路径
}
```

### 11. delete_folder - 删除文件夹

```javascript
{
  "folder_path": "temp/",                   // 必需：文件夹路径
  "recursive": true                         // 可选：是否递归删除，默认false
}
```

### 12. list_folders - 列出文件夹和文件

```javascript
{
  "prefix": "images/"                       // 可选：路径前缀，默认根目录
}
```

### 13. get_folder_stats - 获取文件夹统计

```javascript
{
  "folder_path": "images/"                  // 可选：文件夹路径，为空则统计整个存储桶
}
```

### 14. upload_large_file - 大文件分片上传

```javascript
{
  "file_path": "/path/to/large/video.mp4",    // 必需：本地大文件路径
  "object_key": "videos/video.mp4",           // 可选：COS中的对象键
  "custom_domain": "cdn.example.com",        // 可选：自定义域名
  "chunk_size": 2097152,                     // 可选：分片大小(字节)，默认1MB
  "concurrency": 5,                          // 可选：并发上传数，默认3，最大10
  "force_slice": true                        // 可选：强制使用分片上传
}
```

### 15. get_upload_progress - 获取上传进度

```javascript
{
  "session_id": "abc123def456"               // 可选：特定会话ID，不提供则返回所有
}
```

### 16. clear_upload_progress - 清理上传进度

```javascript
{
  "session_id": "abc123def456"               // 必需：要清理的会话ID
}
```

### 17. manage_temp_files - 管理临时文件

```javascript
{
  "action": "cleanup",                       // 必需：'stats'(统计) 或 'cleanup'(清理)
  "type": "progress",                        // 可选：'progress'/'cache'/'uploads'/'all'
  "older_than_days": 7                       // 可选：清理多少天前的文件，默认7天
}
```

## IDE 集成配置

### 使用本地运行集成

```json
{
  "mcpServers": {
    "tx-cos-mcp": {
      "command": "node",
      "args": ["your-absolute-path/tx-cos-mcp/index.js"],
      "env": {
        "COS_SECRET_ID": "your-secret-id",
        "COS_SECRET_KEY": "your-secret-key",
        "COS_REGION": "your-region",
        "COS_BUCKET": "your-bucket",
        "COS_DOMAIN": "your-custom-domain.com"
      }
    }
  }
}
```

### 已发布到 npm 集成

```json
{
  "mcpServers": {
    "tx-cos-mcp": {
      "command": "npx",
      "args": ["y", "tx-cos-mcp@latest"],
      "env": {
        "COS_SECRET_ID": "your-secret-id",
        "COS_SECRET_KEY": "your-secret-key",
        "COS_REGION": "your-region",
        "COS_BUCKET": "your-bucket",
        "COS_DOMAIN": "your-custom-domain.com"
      },
      "transportType": "stdio"
    }
  }
}
```

#### Claude code 中集成

在配置中添加 MCP 服务器配置，使用相同的 JSON 格式。

#### Cursor IDE

在设置中添加 MCP 服务器配置，使用相同的 JSON 格式。

#### Windsurf IDE

参考官方文档配置 MCP 服务器，使用上述配置参数。

## 常用命令

```bash
# 查看版本
npx tx-cos-mcp --version

# 测试配置
COS_SECRET_ID=xxx COS_SECRET_KEY=xxx COS_REGION=your-region COS_BUCKET=test npx tx-cos-mcp

# 开发模式
npm run dev

# 运行测试
npm run test              # 基础功能测试
npm run test:mcp          # MCP协议合规性测试
npm run test:temp         # 临时目录管理测试
npm run test:cleanup      # 临时文件清理测试
npm run test:path         # 文件路径验证测试

# 发布到npm (维护者)
npm run publish:npm
```

## 测试

项目包含完整的测试套件，确保功能的可靠性：

### 测试文件

- `test/test.js` - 基础功能测试
- `test/test-mcp.js` - MCP协议合规性测试
- `test/test-temp.js` - 临时目录管理测试
- `test/test-cleanup.js` - 临时文件清理测试
- `test/test-path-validation.js` - 文件路径验证测试

### 运行测试

```bash
# 运行所有测试
npm test

# 单独测试
npm run test:mcp          # 测试MCP协议功能
npm run test:temp         # 测试临时目录管理
npm run test:cleanup      # 测试临时文件清理
npm run test:path         # 测试文件路径验证
```

### 测试覆盖

- ✅ COS服务基础功能验证
- ✅ MCP协议标准输出合规性
- ✅ 临时目录结构和管理
- ✅ 上传完成后资源清理
- ✅ 断点续传进度管理
- ✅ 异常情况资源回收
- ✅ 文件路径清理和中文支持

## 开发指南

### 项目结构

```
tx-cos-mcp/
├── index.js              # MCP服务器主入口
├── src/
│   ├── cosService.js     # COS SDK封装服务
│   ├── config.js         # 配置管理
│   ├── uploadProgress.js # 上传进度管理
│   └── tempManager.js    # 临时文件管理
├── test/                 # 测试文件目录
│   ├── test.js           # 基础功能测试
│   ├── test-mcp.js       # MCP协议合规性测试
│   ├── test-temp.js      # 临时目录管理测试
│   └── test-cleanup.js   # 临时文件清理测试
├── config-examples/      # 配置示例
├── package.json          # 项目配置
└── README.md            # 项目文档
```

### 核心依赖

- `@modelcontextprotocol/sdk` - MCP 协议实现
- `cos-nodejs-sdk-v5` - 腾讯云 COS 官方 SDK

### 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/new-feature`)
3. 提交更改 (`git commit -am 'Add new feature'`)
4. 推送分支 (`git push origin feature/new-feature`)
5. 创建 Pull Request

## 许可证

MIT License - 查看[LICENSE](LICENSE)文件了解详情。

## 支持与反馈

- 🐛 **问题反馈**: [GitHub Issues](https://github.com/156554395/tx-cos-mcp/issues)
- 💡 **功能建议**: [GitHub Discussions](https://github.com/156554395/tx-cos-mcp/discussions)
- 📧 **联系作者**: 156554395@qq.com
