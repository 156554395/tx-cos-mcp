# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Architecture Overview

This is a **Model Context Protocol (MCP) server** that provides Tencent Cloud Object Storage (COS) functionality to Claude Desktop, Cursor, Windsurf and other MCP-compatible clients. The architecture follows a modular service-oriented design:

### Core Components

- **index.js**: MCP server entry point - defines 17 tools, handles MCP protocol communication, validates inputs
- **src/cosService.js**: Main service class wrapping Tencent Cloud COS SDK with advanced features (chunked upload, retry logic, resource cleanup)
- **src/config.js**: Environment-based configuration management for COS credentials and settings
- **src/uploadProgress.js**: Progress persistence system for resumable uploads using JSON files
- **src/tempManager.js**: Unified temporary file management with structured directory layout (temp/progress/, temp/cache/, temp/uploads/)

### Key Design Patterns

- **MCP Protocol Compliance**: All stdout must remain clean (no console.log in production) - this is critical for MCP communication
- **Automatic Resource Management**: Every upload operation has corresponding cleanup logic to prevent temp file leaks
- **Intelligent Upload Strategy**: Files >5MB automatically use chunked upload with progress tracking and resume capability
- **Graceful Error Handling**: Network failures trigger exponential backoff retry with configurable limits

## Development Commands

### Essential Commands
```bash
# Install dependencies
pnpm install

# Start MCP server locally
pnpm dev

# Debug with MCP Inspector (essential for MCP development)
pnpm inspector

# Run comprehensive test suite
pnpm test              # Basic functionality
pnpm test:mcp          # MCP protocol compliance
pnpm test:temp         # Temporary file management
pnpm test:cleanup      # Resource cleanup verification
pnpm test:path         # Path validation with Chinese filenames

# Publish to npm (maintainers)
pnpm publish:npm
```

### Testing Strategy
Each test file serves a specific purpose:
- `test/test.js` - Core COS operations validation
- `test/test-mcp.js` - MCP protocol stdout purity verification
- `test/test-temp.js` - Temporary directory management
- `test/test-cleanup.js` - Resource cleanup after operations
- `test/test-path-validation.js` - Chinese filename and space handling

## Configuration Requirements

The server requires these environment variables for COS access:

```bash
export COS_SECRET_ID=your-secret-id
export COS_SECRET_KEY=your-secret-key
export COS_REGION=your-region          # e.g. ap-beijing
export COS_BUCKET=your-bucket          # e.g. my-bucket-1234567890
export COS_DOMAIN=your-domain.com      # Optional custom domain
```

## Critical Implementation Details

### MCP Protocol Compliance
- **Never use `console.log()` in production code** - it pollutes stdout and breaks MCP communication
- All user feedback must be returned through MCP tool responses
- Progress callbacks should be silent or use the provided callback parameter

### File Path Handling
- Always use `validateFileExists()` function to trim whitespace and validate paths
- Support Chinese filenames and paths with spaces
- Return cleaned paths for subsequent operations

### Upload Logic Flow
1. **Small files (<5MB)**: Direct upload via `putObject`
2. **Large files (≥5MB)**: Automatic chunked upload via `sliceUploadFile`
3. **Progress tracking**: MD5-based session IDs for resume capability
4. **Cleanup**: Automatic temp file cleanup on success/failure

### Temporary File Management
Structured temp directory layout:
```
temp/
├── progress/    # Upload progress JSON files
├── cache/       # API response cache
└── uploads/     # Upload lock files and chunks
```

### Error Handling Strategy
- **Network errors**: Exponential backoff retry (3 attempts by default)
- **Configuration errors**: Immediate failure with clear error messages
- **File errors**: Path validation with helpful error context
- **COS API errors**: Preserve original error context while adding helpful context

## Working with Large Files

The chunked upload system (`_uploadLargeFile` in cosService.js) is sophisticated:

- **Session management**: MD5 hash of file path + object key + chunk size creates unique session ID
- **Progress persistence**: JSON files in temp/progress/ store upload state
- **Resume capability**: Can resume interrupted uploads using stored progress
- **Concurrency control**: Configurable parallel chunk uploads (default: 3, max: 10)
- **Resource cleanup**: Automatic cleanup of progress files and temp chunks

## Version Management

Current version: **1.2.0** (performance and reliability enhancements)
- 17 MCP tools (expanded from 13 in v1.1.0)
- Advanced chunked upload with resume
- Comprehensive temporary file management
- Enhanced path validation and Chinese filename support

See `DEVELOPMENT_PLAN.md` for next version roadmap (v1.3.0 focuses on intelligent management and caching).

## MCP Integration Examples

### Claude Desktop
```json
{
  "command": "npx",
  "args": ["-y", "tx-cos-mcp@latest"],
  "env": { /* COS environment variables */ },
  "transportType": "stdio"
}
```

### Local Development
```json
{
  "command": "node",
  "args": ["/absolute/path/to/index.js"],
  "env": { /* COS environment variables */ }
}
```

## Common Development Scenarios

### Adding New MCP Tools
1. Define tool schema in `tools` object in index.js
2. Add handler case in `callTool` handler
3. Implement method in `cosService.js`
4. Add test case in appropriate test file
5. Update documentation

### Debugging MCP Issues
1. Use `pnpm inspector` for interactive testing
2. Check `test/test-mcp.js` for protocol compliance
3. Verify environment variables are correctly set
4. Ensure no console.log statements in production paths

### Working with Tencent COS SDK
- Main SDK instance: `this.cos` in TencentCOSService class
- Bucket/Region from environment configuration
- Error objects preserve original COS error structure
- Support for custom domains via COS_DOMAIN env var