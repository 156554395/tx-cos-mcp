export const cosConfig = {
  SecretId: process.env.COS_SECRET_ID || '',
  SecretKey: process.env.COS_SECRET_KEY || '',
  Region: process.env.COS_REGION || '',
  Bucket: process.env.COS_BUCKET || '',
  Domain: process.env.COS_DOMAIN || '',
  Timeout: 60000
};

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

export function hasValidConfig() {
  return validateConfig();
}