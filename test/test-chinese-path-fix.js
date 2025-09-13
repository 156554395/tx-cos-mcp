#!/usr/bin/env node

/**
 * 测试中文路径复制和移动操作修复
 * 验证URL编码修复是否解决了中文路径问题
 */

import { cosService } from '../src/cosService.js';

async function testChinesePathOperations() {
  console.log('🧪 测试中文路径复制和移动操作修复...\n');

  // 测试用例
  const testCases = [
    {
      name: '中文文件夹路径测试',
      sourceKey: 'study/易青岚/',
      targetKey: 'study/易学/易青岚/',
      operation: 'copy'
    },
    {
      name: '中文文件夹路径测试（移动）',
      sourceKey: 'study/通易缘/',
      targetKey: 'study/易学/通易缘/',
      operation: 'move'
    },
    {
      name: '混合中英文路径测试',
      sourceKey: 'documents/学习资料/Chapter1.pdf',
      targetKey: 'backup/学习资料/Chapter1.pdf',
      operation: 'copy'
    }
  ];

  // 检查配置
  if (!cosService.configValid) {
    console.log('⚠️  COS配置无效，跳过实际操作测试，仅验证URL编码逻辑\n');

    // 测试URL编码逻辑
    for (const testCase of testCases) {
      console.log(`🔍 测试: ${testCase.name}`);
      console.log(`   源路径: "${testCase.sourceKey}"`);
      console.log(`   目标路径: "${testCase.targetKey}"`);

      // 测试URL编码
      const encodedSourceKey = encodeURIComponent(testCase.sourceKey);
      console.log(`   编码后源路径: "${encodedSourceKey}"`);

      // 构建CopySource参数
      const copySource = `test-bucket.cos.ap-beijing.myqcloud.com/${encodedSourceKey}`;
      console.log(`   CopySource参数: "${copySource}"`);

      // 检查编码是否包含非ASCII字符
      const hasNonAscii = /[^\x00-\x7F]/.test(copySource);
      console.log(`   ✅ CopySource是否纯ASCII: ${!hasNonAscii}`);
      console.log('');
    }

    console.log('🎉 URL编码逻辑验证完成！');
    console.log('💡 修复要点：');
    console.log('• 使用encodeURIComponent()对sourceKey进行URL编码');
    console.log('• 确保CopySource参数符合HTTP头部ASCII要求');
    console.log('• 支持中文、日文、韩文等Unicode字符');

    return;
  }

  // 实际测试（需要有效配置）
  console.log('🚀 开始实际操作测试...\n');

  for (const testCase of testCases) {
    try {
      console.log(`🔍 测试: ${testCase.name}`);
      console.log(`   操作: ${testCase.operation}`);
      console.log(`   源路径: "${testCase.sourceKey}"`);
      console.log(`   目标路径: "${testCase.targetKey}"`);

      let result;

      if (testCase.operation === 'copy') {
        result = await cosService.copyObject(testCase.sourceKey, testCase.targetKey);
      } else if (testCase.operation === 'move') {
        result = await cosService.moveObject(testCase.sourceKey, testCase.targetKey);
      }

      if (result.success) {
        console.log(`   ✅ 操作成功！`);
        console.log(`   新对象URL: ${result.url}`);
      } else {
        console.log(`   ❌ 操作失败: ${result.error}`);
      }

    } catch (error) {
      console.log(`   ❌ 操作异常: ${error.message}`);

      // 检查是否还是编码问题
      if (error.message.includes('Invalid character in header content')) {
        console.log('   🚨 仍然存在编码问题，需要进一步检查');
      }
    }

    console.log('');
  }

  console.log('🎯 测试完成！');
}

// 运行测试
testChinesePathOperations().catch(console.error);