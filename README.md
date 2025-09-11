# 腾讯云 COS MCP 服务器

一个基于 Node.js 的 Model Context Protocol (MCP)服务器，为 Claude Desktop、Cursor 和 Windsurf 等 IDE 提供腾讯云对象存储(COS)功能。

## 功能特性

- 🚀 **文件上传** - 支持单文件和批量文件上传到腾讯云 COS
- 🔗 **临时 URL** - 生成带签名的临时访问链接，支持自定义过期时间
- 📋 **文件管理** - 列出存储桶中的对象，支持前缀过滤
- 🗑️ **文件删除** - 安全删除 COS 中的指定对象
- 🔧 **MCP 兼容** - 完全兼容 Model Context Protocol 规范

## 快速开始

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
  "args": ["-y", "tx-cos-mcp"],
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
      "args": ["y", "tx-cos-mcp"],
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

# 发布到npm (维护者)
npm run publish:npm
```

## 开发指南

### 项目结构

```
tx-cos-mcp/
├── index.js              # MCP服务器主入口
├── src/
│   ├── cosService.js     # COS SDK封装服务
│   └── config.js         # 配置管理
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
