#!/usr/bin/env node

/**
 * 临时目录管理功能验证脚本
 */

import { initTempDirs, getTempDirStats, cleanupTempFiles, TEMP_DIRS } from '../src/tempManager.js';
import { saveProgress, loadProgress, clearProgress } from '../src/uploadProgress.js';
import fs from 'fs/promises';

async function testTempDirManagement() {
  console.log('🔍 测试临时目录管理功能...');

  try {
    // 初始化临时目录
    await initTempDirs();
    console.log('✓ 临时目录初始化成功');

    // 验证目录是否存在
    for (const [name, dirPath] of Object.entries(TEMP_DIRS)) {
      try {
        await fs.access(dirPath);
        console.log(`✓ ${name} 目录存在: ${dirPath}`);
      } catch (error) {
        console.error(`✗ ${name} 目录不存在: ${dirPath}`);
      }
    }

    // 创建一些测试进度文件
    await saveProgress('test-session-1', {
      filePath: '/test/file1.txt',
      objectKey: 'test1.txt',
      fileSize: 1024 * 1024,
      chunkSize: 1024 * 1024,
      percent: 50
    });

    await saveProgress('test-session-2', {
      filePath: '/test/file2.txt',
      objectKey: 'test2.txt',
      fileSize: 2048 * 1024,
      chunkSize: 1024 * 1024,
      percent: 75
    });

    console.log('✓ 创建测试进度文件成功');

    // 获取统计信息
    const stats = await getTempDirStats();
    console.log('✓ 临时目录统计:', JSON.stringify(stats, null, 2));

    // 测试清理功能
    const cleanedCount = await cleanupTempFiles('progress', 0); // 清理所有进度文件
    console.log(`✓ 清理了 ${cleanedCount} 个临时文件`);

    // 验证文件是否被清理
    const progress1 = await loadProgress('test-session-1');
    const progress2 = await loadProgress('test-session-2');

    if (progress1 === null && progress2 === null) {
      console.log('✓ 进度文件清理验证成功');
    } else {
      console.error('✗ 进度文件清理失败');
    }

    console.log('\n🎉 临时目录管理功能验证完成！');

    // 显示目录结构
    console.log('\n📁 临时目录结构：');
    console.log('temp/');
    console.log('├── progress/  (上传进度文件)');
    console.log('├── cache/     (缓存文件)');
    console.log('└── uploads/   (上传临时文件)');

  } catch (error) {
    console.error('✗ 临时目录管理功能测试失败:', error.message);
    throw error;
  }
}

// 运行测试
testTempDirManagement().catch(console.error);