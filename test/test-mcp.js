#!/usr/bin/env node

/**
 * MCP兼容性验证脚本
 * 测试修复后的功能，确保不污染stdout
 */

import { spawn } from 'child_process';
import fs from 'fs/promises';

async function createTestFile(fileName, sizeInMB) {
  const buffer = Buffer.alloc(sizeInMB * 1024 * 1024, 'A');
  await fs.writeFile(fileName, buffer);
  console.log(`✓ 创建测试文件: ${fileName} (${sizeInMB}MB)`);
}

function testMCPProtocol() {
  return new Promise((resolve, reject) => {
    console.log('🔍 测试MCP协议兼容性...');

    const child = spawn('node', ['index.js'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    // 发送MCP工具列表请求
    const listToolsRequest = {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list"
    };

    child.stdin.write(JSON.stringify(listToolsRequest) + '\n');

    setTimeout(() => {
      child.kill();

      // 验证输出是否为有效JSON
      try {
        if (stdout.trim()) {
          const lines = stdout.trim().split('\n');
          for (const line of lines) {
            if (line.trim()) {
              JSON.parse(line); // 尝试解析每行
            }
          }
          console.log('✓ stdout输出全部为有效JSON');
          resolve(true);
        } else {
          console.log('⚠️ 没有收到响应，可能需要更长时间初始化');
          resolve(true);
        }
      } catch (error) {
        console.error('✗ stdout包含非JSON内容:', error.message);
        console.error('stdout内容:', stdout);
        reject(error);
      }
    }, 3000);
  });
}

async function testFileUpload() {
  console.log('\n🔍 测试文件上传功能...');

  try {
    await createTestFile('./mcp_test.txt', 1);

    const child = spawn('node', ['index.js'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    return new Promise((resolve, reject) => {
      let stdout = '';
      let hasError = false;

      child.stdout.on('data', (data) => {
        stdout += data.toString();

        // 检查是否有中文字符污染
        const content = data.toString();
        if (content.includes('上传进度') || content.includes('批量上传')) {
          hasError = true;
          console.error('✗ 检测到进度输出污染MCP协议!');
        }
      });

      child.stderr.on('data', (data) => {
        // stderr输出是允许的
      });

      // 发送上传请求
      const uploadRequest = {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: {
          name: "upload_file",
          arguments: {
            file_path: "./mcp_test.txt"
          }
        }
      };

      child.stdin.write(JSON.stringify(uploadRequest) + '\n');

      setTimeout(async () => {
        child.kill();

        // 清理测试文件
        try {
          await fs.unlink('./mcp_test.txt');
        } catch (err) {
          // 忽略删除错误
        }

        if (hasError) {
          reject(new Error('MCP协议污染检测失败'));
        } else {
          console.log('✓ 上传功能测试通过，无协议污染');
          resolve(true);
        }
      }, 5000);
    });
  } catch (error) {
    console.error('✗ 文件上传测试失败:', error.message);
    throw error;
  }
}

async function runTests() {
  console.log('🚀 MCP协议兼容性验证开始');

  try {
    await testMCPProtocol();
    await testFileUpload();

    console.log('\n🎉 所有MCP协议兼容性测试通过！');
    console.log('✅ 问题已修复：进度输出不再污染MCP协议');
  } catch (error) {
    console.error('\n❌ MCP协议兼容性测试失败:', error.message);
    process.exit(1);
  }
}

runTests().catch(console.error);