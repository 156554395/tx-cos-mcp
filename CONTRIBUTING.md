# 贡献指南

感谢您有兴趣为腾讯云 COS MCP 服务器贡献代码！

## 开发环境设置

1. 克隆仓库

```bash
git clone https://github.com/156554395/tx-cos-mcp.git
cd tx-cos-mcp
```

2. 安装依赖

```bash
npm install
```

3. 创建.env 文件并配置您的腾讯云 COS 凭证

```bash
cp .env.example .env
# 编辑.env文件填入您的配置
```

## 代码规范

- 使用 ES6+语法
- 遵循现有代码风格
- 添加适当的错误处理
- 为新功能添加测试
- 更新文档以反映任何变化

## 提交规范

使用语义化提交消息：

- `feat:` 新功能
- `fix:` 修复 bug
- `docs:` 文档更新
- `refactor:` 代码重构
- `test:` 测试更新
- `chore:` 构建过程或辅助工具变动

## 功能请求和 Bug 报告

- 使用 GitHub Issues 功能
- 提供详细描述和复现步骤
- 使用相关标签

## 拉取请求

1. Fork 仓库
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'feat: add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 打开 Pull Request

## 测试

确保添加测试用例：

```bash
npm test
```

## 许可证

通过贡献，您同意您的贡献将根据 MIT 许可证发布。
