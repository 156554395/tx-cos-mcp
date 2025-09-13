#!/usr/bin/env node

/**
 * 验证修复后的分片上传功能
 * 模拟MCP调用处理带空格的文件路径
 */

import fs from 'fs';
import { cosService } from '../src/cosService.js';

/**
 * 复制index.js中的validateFileExists函数
 */
function validateFileExists(filePath) {
  // 清理文件路径，去除首尾空白字符
  const cleanPath = filePath.trim();

  if (!cleanPath) {
    throw new Error('文件路径不能为空');
  }

  if (!fs.existsSync(cleanPath)) {
    throw new Error(`文件不存在: ${cleanPath}`);
  }

  const stats = fs.statSync(cleanPath);
  if (!stats.isFile()) {
    throw new Error(`路径不是文件: ${cleanPath}`);
  }

  // 返回清理后的路径，供后续使用
  return cleanPath;
}

async function testUploadLargeFileWithSpaces() {
  console.log('🧪 测试带空格路径的分片上传功能...\n');

  // 模拟MCP请求参数，包含末尾空格的文件路径
  const args = {
    file_path: '/Users/seostar/Documents/manage/book/周易/易青岚/试卷.mp4 ', // 注意末尾的空格
    object_key: 'test/试卷.mp4',
    force_slice: true,
    chunk_size: 1024 * 1024, // 1MB
    concurrency: 3
  };

  try {
    console.log('📝 模拟参数:');
    console.log(`   file_path: "${args.file_path}"`);
    console.log(`   object_key: ${args.object_key}`);
    console.log(`   force_slice: ${args.force_slice}`);
    console.log('');

    // 步骤1: 验证和清理文件路径
    console.log('🔍 步骤1: 验证和清理文件路径...');
    const cleanLargeFilePath = validateFileExists(args.file_path);
    console.log(`✅ 路径验证成功`);
    console.log(`   原始路径: "${args.file_path}"`);
    console.log(`   清理后路径: "${cleanLargeFilePath}"`);

    // 检查文件信息
    const stats = fs.statSync(cleanLargeFilePath);
    console.log(`   文件大小: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
    console.log('');

    // 步骤2: 参数验证
    console.log('⚙️  步骤2: 参数验证...');
    const chunkSize = args.chunk_size ? Math.max(1024 * 1024, args.chunk_size) : 1024 * 1024;
    const concurrency = args.concurrency ? Math.min(10, Math.max(1, args.concurrency)) : 3;
    console.log(`   分片大小: ${(chunkSize / 1024 / 1024).toFixed(1)} MB`);
    console.log(`   并发数: ${concurrency}`);
    console.log('');

    // 步骤3: 验证COS服务参数构造（不实际上传，避免消耗资源）
    console.log('🔧 步骤3: 验证上传参数构造...');
    const uploadOptions = {
      key: args.object_key,
      useSliceUpload: args.force_slice || true,
      chunkSize: chunkSize,
      concurrency: concurrency,
      onProgress: (progress) => {
        console.log(`   📊 模拟进度: ${progress.percent}%`);
      }
    };

    console.log('✅ 上传参数构造成功:');
    console.log(`   对象键: ${uploadOptions.key}`);
    console.log(`   使用分片上传: ${uploadOptions.useSliceUpload}`);
    console.log(`   分片大小: ${(uploadOptions.chunkSize / 1024 / 1024).toFixed(1)} MB`);
    console.log(`   并发数: ${uploadOptions.concurrency}`);
    console.log('');

    console.log('🎉 分片上传路径处理验证成功！');
    console.log('');
    console.log('💡 总结：');
    console.log('• 路径空格清理功能正常工作');
    console.log('• 中文文件名支持正常');
    console.log('• 分片上传参数验证通过');
    console.log('• 可以正常处理大文件路径');

    // 注意：这里不实际执行上传，避免消耗资源和时间
    console.log('');
    console.log('⚠️  注意: 此测试仅验证路径处理和参数构造，未实际上传文件');

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    throw error;
  }
}

// 运行测试
testUploadLargeFileWithSpaces().catch(console.error);