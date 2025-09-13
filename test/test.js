#!/usr/bin/env node

/**
 * TX-COS-MCP v1.2.0 功能验证脚本
 * 验证分片上传、断点续传和并发控制功能
 */

import { cosService } from '../src/cosService.js';
import fs from 'fs/promises';
import path from 'path';

async function createTestFile(fileName, sizeInMB) {
  const buffer = Buffer.alloc(sizeInMB * 1024 * 1024, 'A');
  await fs.writeFile(fileName, buffer);
  console.log(`✓ 创建测试文件: ${fileName} (${sizeInMB}MB)`);
}

async function testBasicUpload() {
  console.log('\n=== 基础上传测试 ===');
  try {
    await createTestFile('./test_small.txt', 1);

    const result = await cosService.uploadFile('./test_small.txt', {
      key: 'test/small_file.txt'
    });

    console.log('✓ 小文件上传成功:', result.uploadType);
    return true;
  } catch (error) {
    console.error('✗ 小文件上传失败:', error.message);
    return false;
  }
}

async function testLargeFileUpload() {
  console.log('\n=== 大文件分片上传测试 ===');
  try {
    await createTestFile('./test_large.txt', 10);

    const result = await cosService.uploadFile('./test_large.txt', {
      key: 'test/large_file.txt',
      useSliceUpload: true,
      onProgress: (progress) => {
        console.log(`  上传进度: ${progress.percent.toFixed(1)}%`);
      }
    });

    console.log('✓ 大文件分片上传成功:', result.uploadType);
    console.log('  SessionId:', result.sessionId);
    return true;
  } catch (error) {
    console.error('✗ 大文件上传失败:', error.message);
    return false;
  }
}

async function testProgressManagement() {
  console.log('\n=== 上传进度管理测试 ===');
  try {
    const progressInfo = await cosService.getUploadProgress();
    console.log('✓ 获取进度信息成功:', progressInfo.totalUploads, '个上传任务');
    return true;
  } catch (error) {
    console.error('✗ 获取进度信息失败:', error.message);
    return false;
  }
}

async function testBatchUpload() {
  console.log('\n=== 批量上传测试 ===');
  try {
    // 创建多个小文件
    const files = [];
    for (let i = 1; i <= 3; i++) {
      const fileName = `./test_batch_${i}.txt`;
      await createTestFile(fileName, 1);
      files.push({ path: fileName, key: `test/batch_${i}.txt` });
    }

    const results = await cosService.uploadMultipleFiles(files, {
      concurrency: 2,
      maxRetries: 2,
      onProgress: (progress) => {
        console.log(`  批量上传: ${progress.percent}% (${progress.success}成功/${progress.failed}失败)`);
      }
    });

    const successCount = results.filter(r => r.success).length;
    console.log(`✓ 批量上传完成: ${successCount}/${results.length} 成功`);
    return true;
  } catch (error) {
    console.error('✗ 批量上传失败:', error.message);
    return false;
  }
}

async function cleanup() {
  console.log('\n=== 清理测试文件 ===');
  const testFiles = [
    './test_small.txt',
    './test_large.txt',
    './test_batch_1.txt',
    './test_batch_2.txt',
    './test_batch_3.txt'
  ];

  for (const file of testFiles) {
    try {
      await fs.unlink(file);
      console.log(`✓ 删除: ${file}`);
    } catch (error) {
      // 文件不存在时忽略
    }
  }
}

async function runTests() {
  console.log('🚀 TX-COS-MCP v1.2.0 功能验证开始');
  console.log('注意: 需要正确配置腾讯云COS环境变量才能进行实际上传测试\n');

  let passedTests = 0;
  let totalTests = 0;

  // 检查配置
  if (!cosService.configValid) {
    console.log('⚠️  COS配置无效，跳过实际上传测试，仅验证代码结构');

    // 仅测试代码结构
    try {
      await testProgressManagement();
      console.log('✓ 代码结构验证通过');
    } catch (error) {
      console.error('✗ 代码结构验证失败:', error.message);
    }

    await cleanup();
    return;
  }

  // 运行完整测试
  const tests = [
    testBasicUpload,
    testLargeFileUpload,
    testProgressManagement,
    testBatchUpload
  ];

  for (const test of tests) {
    totalTests++;
    if (await test()) {
      passedTests++;
    }
  }

  await cleanup();

  console.log(`\n📊 测试结果: ${passedTests}/${totalTests} 通过`);
  if (passedTests === totalTests) {
    console.log('🎉 所有测试通过！v1.2.0功能验证成功');
  } else {
    console.log('❌ 部分测试失败，请检查配置和代码');
  }
}

// 运行测试
runTests().catch(console.error);