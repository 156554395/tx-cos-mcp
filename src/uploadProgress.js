import fs from 'fs/promises';
import path from 'path';
import { TEMP_DIRS, initTempDirs } from './tempManager.js';

/**
 * 上传进度管理模块
 * 用于保存、读取和管理文件上传的断点续传进度信息
 */

/**
 * 保存上传进度
 * @param {string} uploadId - 上传ID
 * @param {Object} progress - 进度信息
 * @param {string} progress.filePath - 文件路径
 * @param {string} progress.objectKey - 对象键
 * @param {number} progress.fileSize - 文件大小
 * @param {number} progress.chunkSize - 分片大小
 * @param {Array} progress.uploadedParts - 已上传分片信息
 */
export async function saveProgress(uploadId, progress) {
  await initTempDirs();
  const progressFile = path.join(TEMP_DIRS.PROGRESS, `${uploadId}.json`);
  const progressData = {
    ...progress,
    lastUpdated: new Date().toISOString()
  };
  await fs.writeFile(progressFile, JSON.stringify(progressData, null, 2));
}

/**
 * 读取上传进度
 * @param {string} uploadId - 上传ID
 * @returns {Promise<Object|null>} 进度信息，不存在则返回null
 */
export async function loadProgress(uploadId) {
  try {
    const progressFile = path.join(TEMP_DIRS.PROGRESS, `${uploadId}.json`);
    const data = await fs.readFile(progressFile, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return null;
  }
}

/**
 * 清理上传进度
 * @param {string} uploadId - 上传ID
 */
export async function clearProgress(uploadId) {
  try {
    const progressFile = path.join(TEMP_DIRS.PROGRESS, `${uploadId}.json`);
    await fs.unlink(progressFile);
  } catch (error) {
    // 文件不存在时忽略错误
  }
}