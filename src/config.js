/**
 * 腾讯云COS配置管理模块
 * 负责从环境变量读取配置并进行验证
 * 
 * @author 156554395@qq.com
 */

/**
 * COS配置对象
 * 从环境变量中读取腾讯云COS的配置信息
 * 
 * 必需的环境变量：
 * - COS_SECRET_ID: 腾讯云访问密钥ID
 * - COS_SECRET_KEY: 腾讯云访问密钥
 * - COS_REGION: COS地域标识（如ap-beijing）
 * - COS_BUCKET: 存储桶名称
 * 
 * 可选的环境变量：
 * - COS_DOMAIN: 自定义访问域名（CDN域名等）
 */
export const cosConfig = {
  SecretId: process.env.COS_SECRET_ID || '',
  SecretKey: process.env.COS_SECRET_KEY || '',
  Region: process.env.COS_REGION || '',
  Bucket: process.env.COS_BUCKET || '',
  Domain: process.env.COS_DOMAIN || '',
  Timeout: 60000  // 请求超时时间（毫秒）
};

/**
 * 验证COS配置是否完整
 * 检查所有必需的配置项是否已设置
 * 
 * @returns {boolean} 配置是否有效
 */
export function validateConfig() {
  const requiredKeys = ['SecretId', 'SecretKey', 'Region', 'Bucket'];
  const missingKeys = requiredKeys.filter(key => !cosConfig[key]);
  
  if (missingKeys.length > 0) {
    console.error(`警告: 缺少必要的配置项: ${missingKeys.join(', ')}`);
    console.error('请设置以下环境变量:');
    console.error('COS_SECRET_ID, COS_SECRET_KEY, COS_REGION, COS_BUCKET');
    return false;
  }
  return true;
}

/**
 * 检查是否有有效的配置
 * validateConfig函数的别名，提供更语义化的函数名
 * 
 * @returns {boolean} 配置是否有效
 */
export function hasValidConfig() {
  return validateConfig();
}