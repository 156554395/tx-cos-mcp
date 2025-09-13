#!/usr/bin/env node

/**
 * 临时文件清理功能验证脚本
 * 测试上传完成后的文件清理机制
 */

import { cosService } from '../src/cosService.js';
import { TEMP_DIRS, initTempDirs, getTempDirStats } from '../src/tempManager.js';
import fs from 'fs/promises';
import path from 'path';

async function createTestTempFiles() {
  console.log('🔄 创建测试临时文件...');

  // 创建模拟的临时文件
  const testFiles = [
    { path: path.join(TEMP_DIRS.UPLOADS, 'test_file_temp'), content: 'test upload temp' },
    { path: path.join(TEMP_DIRS.UPLOADS, 'test_file_temp.part'), content: 'test part file' },
    { path: path.join(TEMP_DIRS.CACHE, 'test_file_cache.json'), content: '{"test": "cache"}' },
    { path: path.join(TEMP_DIRS.UPLOADS, 'upload_lock_12345.lock'), content: 'lock file' },
    { path: path.join(TEMP_DIRS.UPLOADS, 'batch_upload_queue.json'), content: '[]' }
  ];

  for (const file of testFiles) {
    await fs.writeFile(file.path, file.content);
  }

  // 创建测试分片目录
  const chunkDir = path.join(TEMP_DIRS.UPLOADS, 'chunks_test_file');
  await fs.mkdir(chunkDir, { recursive: true });
  await fs.writeFile(path.join(chunkDir, 'chunk1.tmp'), 'chunk data');

  console.log('✓ 测试临时文件创建完成');
}

async function testCleanupFunctions() {
  console.log('🧹 测试清理功能...');

  try {
    // 测试单个文件清理
    await cosService._cleanupUploadTempFiles('test_file');
    console.log('✓ 单文件清理方法测试完成');

    // 测试批量清理
    await cosService._cleanupBatchUploadTempFiles();
    console.log('✓ 批量清理方法测试完成');

    // 检查文件是否被清理
    const stats = await getTempDirStats();
    console.log('📊 清理后的临时目录统计:');
    console.log(JSON.stringify(stats, null, 2));

    // 验证特定文件是否被清理
    const testFilePath = path.join(TEMP_DIRS.UPLOADS, 'test_file_temp');
    try {
      await fs.access(testFilePath);
      console.log('⚠️  警告: test_file_temp 未被清理');
    } catch {
      console.log('✓ test_file_temp 已成功清理');
    }

    const batchFilePath = path.join(TEMP_DIRS.UPLOADS, 'batch_upload_queue.json');
    try {
      await fs.access(batchFilePath);
      console.log('⚠️  警告: batch_upload_queue.json 未被清理');
    } catch {
      console.log('✓ batch_upload_queue.json 已成功清理');
    }

  } catch (error) {
    console.error('✗ 清理功能测试失败:', error.message);
    throw error;
  }
}

async function runCleanupTest() {
  console.log('🧪 开始临时文件清理功能测试...\n');

  try {
    // 初始化临时目录
    await initTempDirs();
    console.log('✓ 临时目录初始化完成');

    // 创建测试文件
    await createTestTempFiles();

    // 获取清理前的统计
    console.log('\n📊 清理前的临时目录统计:');
    const beforeStats = await getTempDirStats();
    console.log(JSON.stringify(beforeStats, null, 2));

    // 测试清理功能
    console.log('\n');
    await testCleanupFunctions();

    console.log('\n🎉 临时文件清理功能测试完成！');

    // 显示清理说明
    console.log('\n📝 清理机制说明：');
    console.log('• 上传成功后自动清理相关临时文件');
    console.log('• 上传失败后清理临时文件但保留进度文件（用于断点续传）');
    console.log('• 批量上传完成后清理批量操作临时文件');
    console.log('• 异常情况下也会尝试清理，确保资源不泄漏');

  } catch (error) {
    console.error('✗ 临时文件清理功能测试失败:', error.message);
    process.exit(1);
  }
}

// 运行测试
runCleanupTest().catch(console.error);