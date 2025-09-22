import fs from 'fs/promises';
import path from 'path';
import os from 'os';

/**
 * 临时文件管理模块
 * 统一管理TX-COS-MCP的临时文件和目录
 * 使用系统缓存目录而不是项目目录
 */

// 获取系统缓存目录下的应用专属目录
const getAppCacheDir = () => {
  const systemTempDir = os.tmpdir();
  return path.join(systemTempDir, 'tx-cos-mcp');
};

const APP_CACHE_ROOT = getAppCacheDir();

export const TEMP_DIRS = {
  ROOT: APP_CACHE_ROOT,
  PROGRESS: path.join(APP_CACHE_ROOT, 'progress'),
  CACHE: path.join(APP_CACHE_ROOT, 'cache'),
  UPLOADS: path.join(APP_CACHE_ROOT, 'uploads')
};

/**
 * 初始化所有临时目录
 * @returns {Promise<void>}
 */
export async function initTempDirs() {
  for (const dirPath of Object.values(TEMP_DIRS)) {
    try {
      await fs.access(dirPath);
    } catch (error) {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }
}

/**
 * 清理指定类型的临时文件
 * @param {string} type - 清理类型：'progress', 'cache', 'uploads', 'all'
 * @param {number} [olderThanDays=7] - 清理多少天前的文件
 * @returns {Promise<number>} 清理的文件数量
 */
export async function cleanupTempFiles(type = 'all', olderThanDays = 7) {
  const cutoffTime = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
  let cleanedCount = 0;

  const dirsToClean = type === 'all'
    ? Object.values(TEMP_DIRS).filter(dir => dir !== TEMP_DIRS.ROOT)
    : [TEMP_DIRS[type.toUpperCase()]];

  for (const dirPath of dirsToClean) {
    try {
      const files = await fs.readdir(dirPath);

      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const stats = await fs.stat(filePath);

        if (stats.mtime.getTime() < cutoffTime) {
          await fs.unlink(filePath);
          cleanedCount++;
        }
      }
    } catch (error) {
      // 目录不存在时忽略错误
      if (error.code !== 'ENOENT') {
        console.error(`清理临时文件失败: ${error.message}`);
      }
    }
  }

  return cleanedCount;
}

/**
 * 获取临时目录使用统计
 * @returns {Promise<Object>} 目录统计信息
 */
export async function getTempDirStats() {
  const stats = {};

  for (const [name, dirPath] of Object.entries(TEMP_DIRS)) {
    if (name === 'ROOT') continue;

    try {
      const files = await fs.readdir(dirPath);
      let totalSize = 0;

      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const fileStat = await fs.stat(filePath);
        totalSize += fileStat.size;
      }

      stats[name.toLowerCase()] = {
        fileCount: files.length,
        totalSize: totalSize,
        totalSizeFormatted: formatFileSize(totalSize)
      };
    } catch (error) {
      stats[name.toLowerCase()] = {
        fileCount: 0,
        totalSize: 0,
        totalSizeFormatted: '0 B'
      };
    }
  }

  return stats;
}

/**
 * 格式化文件大小
 * @param {number} bytes - 字节数
 * @returns {string} 格式化后的大小
 * @private
 */
function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}