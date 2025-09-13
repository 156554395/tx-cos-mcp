#!/usr/bin/env node

/**
 * 文件路径验证和清理功能测试
 * 测试路径空格处理和中文路径支持
 */

import fs from 'fs';

/**
 * 验证本地文件是否存在（复制自index.js）
 * @param {string} filePath - 文件路径
 * @throws {Error} 当文件不存在或路径不是文件时抛出错误
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

async function testPathValidation() {
  console.log('🧪 开始文件路径验证测试...\n');

  const testCases = [
    {
      name: '正常路径',
      path: '/Users/seostar/Documents/study/ai/claude/tx-cos-mcp/package.json',
      expectSuccess: true
    },
    {
      name: '路径末尾有空格',
      path: '/Users/seostar/Documents/study/ai/claude/tx-cos-mcp/package.json ',
      expectSuccess: true
    },
    {
      name: '路径开头有空格',
      path: ' /Users/seostar/Documents/study/ai/claude/tx-cos-mcp/package.json',
      expectSuccess: true
    },
    {
      name: '路径前后都有空格',
      path: ' /Users/seostar/Documents/study/ai/claude/tx-cos-mcp/package.json ',
      expectSuccess: true
    },
    {
      name: '中文路径（如果存在）',
      path: '/Users/seostar/Documents/manage/book/周易/易青岚/试卷.mp4',
      expectSuccess: true
    },
    {
      name: '中文路径末尾有空格',
      path: '/Users/seostar/Documents/manage/book/周易/易青岚/试卷.mp4 ',
      expectSuccess: true
    },
    {
      name: '空字符串',
      path: '',
      expectSuccess: false
    },
    {
      name: '只有空格',
      path: '   ',
      expectSuccess: false
    },
    {
      name: '不存在的文件',
      path: '/not/exist/file.txt',
      expectSuccess: false
    }
  ];

  for (const testCase of testCases) {
    try {
      console.log(`🔍 测试: ${testCase.name}`);
      console.log(`   路径: "${testCase.path}"`);

      const cleanPath = validateFileExists(testCase.path);

      if (testCase.expectSuccess) {
        console.log(`   ✅ 验证成功，清理后路径: "${cleanPath}"`);

        // 检查清理效果
        if (testCase.path !== cleanPath) {
          console.log(`   🧹 路径已清理：删除了首尾空格`);
        }
      } else {
        console.log(`   ❌ 预期失败但实际成功了`);
      }

    } catch (error) {
      if (!testCase.expectSuccess) {
        console.log(`   ✅ 预期失败: ${error.message}`);
      } else {
        console.log(`   ❌ 意外失败: ${error.message}`);
      }
    }
    console.log('');
  }

  // 特殊测试：检查实际的问题文件
  console.log('🎯 测试实际问题文件...');
  try {
    const problemPath = '/Users/seostar/Documents/manage/book/周易/易青岚/试卷.mp4 ';
    console.log(`测试路径: "${problemPath}"`);

    const cleanPath = validateFileExists(problemPath);
    console.log(`✅ 成功！清理后路径: "${cleanPath}"`);

    // 显示文件信息
    const stats = fs.statSync(cleanPath);
    console.log(`📊 文件大小: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
    console.log(`📅 修改时间: ${stats.mtime.toISOString()}`);

  } catch (error) {
    console.log(`❌ 失败: ${error.message}`);
  }

  console.log('\n🎉 文件路径验证测试完成！');
}

// 运行测试
testPathValidation().catch(console.error);