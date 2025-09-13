#!/usr/bin/env node

/**
 * TX-COS-MCP 服务器主入口文件
 * 基于 Model Context Protocol (MCP) 的腾讯云 COS 服务器实现
 * 
 * 提供以下功能：
 * - 文件上传（单个/批量）
 * - 文件操作（复制/移动/重命名）
 * - 文件删除（单个/批量）
 * - 文件夹管理（创建/删除/列举）
 * - 存储统计分析
 * - 临时URL生成
 * 
 * @author 156554395@qq.com
 * @version 1.2.0
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import fs from 'fs';
import { cosService } from './src/cosService.js';

// 创建MCP服务器实例
const server = new Server(
  {
    name: 'tx-cos-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

/**
 * MCP工具定义
 * 每个工具对应一个COS操作功能，包含名称、描述和输入参数架构
 */
const tools = {
  // 文件上传工具
  upload_file: {
    name: 'upload_file',
    description: '上传单个文件到腾讯云COS',
    inputSchema: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: '本地文件路径'
        },
        object_key: {
          type: 'string',
          description: '上传后在COS中的对象键名，如果未提供则使用文件名'
        },
        custom_domain: {
          type: 'string',
          description: '自定义访问域名（可选）'
        }
      },
      required: ['file_path']
    }
  },
  upload_multiple: {
    name: 'upload_multiple',
    description: '批量上传多个文件到腾讯云COS，支持智能并发控制和重试机制',
    inputSchema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              file_path: { type: 'string', description: '本地文件路径' },
              object_key: { type: 'string', description: '上传后在COS中的对象键名' }
            },
            required: ['file_path']
          },
          description: '文件数组，每个元素包含file_path和可选的object_key'
        },
        concurrency: {
          type: 'number',
          description: '并发上传数量，默认3，最大20'
        },
        max_retries: {
          type: 'number',
          description: '单个文件最大重试次数，默认3'
        }
      },
      required: ['files']
    }
  },

  // 大文件分片上传工具
  upload_large_file: {
    name: 'upload_large_file',
    description: '使用分片上传方式上传大文件到腾讯云COS，支持断点续传和进度监控',
    inputSchema: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: '本地文件路径'
        },
        object_key: {
          type: 'string',
          description: '上传后在COS中的对象键名，如果未提供则使用文件名'
        },
        custom_domain: {
          type: 'string',
          description: '自定义访问域名（可选）'
        },
        chunk_size: {
          type: 'number',
          description: '分片大小（字节），默认1MB，最小1MB'
        },
        concurrency: {
          type: 'number',
          description: '并发上传数量，默认3，最大10'
        },
        force_slice: {
          type: 'boolean',
          description: '强制使用分片上传，即使文件较小'
        }
      },
      required: ['file_path']
    }
  },

  // 上传进度管理工具
  get_upload_progress: {
    name: 'get_upload_progress',
    description: '获取当前所有未完成上传的进度信息',
    inputSchema: {
      type: 'object',
      properties: {
        session_id: {
          type: 'string',
          description: '特定会话ID，不提供则返回所有未完成上传'
        }
      }
    }
  },

  clear_upload_progress: {
    name: 'clear_upload_progress',
    description: '清理指定的上传进度记录',
    inputSchema: {
      type: 'object',
      properties: {
        session_id: {
          type: 'string',
          description: '要清理的会话ID'
        }
      },
      required: ['session_id']
    }
  },

  // 临时文件管理工具
  manage_temp_files: {
    name: 'manage_temp_files',
    description: '管理临时文件和目录，支持清理和统计功能',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['stats', 'cleanup'],
          description: '操作类型：stats(统计) 或 cleanup(清理)'
        },
        type: {
          type: 'string',
          enum: ['progress', 'cache', 'uploads', 'all'],
          description: '文件类型，默认all'
        },
        older_than_days: {
          type: 'number',
          description: '清理多少天前的文件，默认7天'
        }
      },
      required: ['action']
    }
  },
  
  // URL工具
  get_signed_url: {
    name: 'get_signed_url',
    description: '获取COS对象的临时签名URL',
    inputSchema: {
      type: 'object',
      properties: {
        object_key: {
          type: 'string',
          description: 'COS中的对象键名'
        },
        expire_time: {
          type: 'number',
          description: 'URL有效期（秒），默认3600秒'
        }
      },
      required: ['object_key']
    }
  },
  
  // 列表和查询工具
  list_objects: {
    name: 'list_objects',
    description: '列出COS中的对象',
    inputSchema: {
      type: 'object',
      properties: {
        prefix: {
          type: 'string',
          description: '对象键的过滤前缀，默认列出所有对象'
        }
      }
    }
  },
  
  // 删除工具
  delete_object: {
    name: 'delete_object',
    description: '删除COS中的对象',
    inputSchema: {
      type: 'object',
      properties: {
        object_key: {
          type: 'string',
          description: '要删除的对象键名'
        }
      },
      required: ['object_key']
    }
  },
  
  // 文件操作工具
  copy_object: {
    name: 'copy_object',
    description: '复制COS中的对象',
    inputSchema: {
      type: 'object',
      properties: {
        source_key: {
          type: 'string',
          description: '源对象键名'
        },
        target_key: {
          type: 'string',
          description: '目标对象键名'
        },
        target_bucket: {
          type: 'string',
          description: '目标存储桶名称（可选，默认为当前存储桶）'
        }
      },
      required: ['source_key', 'target_key']
    }
  },
  move_object: {
    name: 'move_object',
    description: '移动COS中的对象',
    inputSchema: {
      type: 'object',
      properties: {
        source_key: {
          type: 'string',
          description: '源对象键名'
        },
        target_key: {
          type: 'string',
          description: '目标对象键名'
        },
        target_bucket: {
          type: 'string',
          description: '目标存储桶名称（可选，默认为当前存储桶）'
        }
      },
      required: ['source_key', 'target_key']
    }
  },
  rename_object: {
    name: 'rename_object',
    description: '重命名COS中的对象',
    inputSchema: {
      type: 'object',
      properties: {
        old_key: {
          type: 'string',
          description: '原对象键名'
        },
        new_key: {
          type: 'string',
          description: '新对象键名'
        }
      },
      required: ['old_key', 'new_key']
    }
  },
  
  // 批量操作工具
  delete_multiple: {
    name: 'delete_multiple',
    description: '批量删除COS中的对象',
    inputSchema: {
      type: 'object',
      properties: {
        object_keys: {
          type: 'array',
          items: {
            type: 'string'
          },
          description: '要删除的对象键名数组'
        }
      },
      required: ['object_keys']
    }
  },
  
  // 文件夹管理工具
  create_folder: {
    name: 'create_folder',
    description: '在COS中创建文件夹',
    inputSchema: {
      type: 'object',
      properties: {
        folder_path: {
          type: 'string',
          description: '文件夹路径'
        }
      },
      required: ['folder_path']
    }
  },
  delete_folder: {
    name: 'delete_folder',
    description: '删除COS中的文件夹',
    inputSchema: {
      type: 'object',
      properties: {
        folder_path: {
          type: 'string',
          description: '文件夹路径'
        },
        recursive: {
          type: 'boolean',
          description: '是否递归删除（删除文件夹及其所有内容），默认false'
        }
      },
      required: ['folder_path']
    }
  },
  list_folders: {
    name: 'list_folders',
    description: '列出COS中的文件夹和文件',
    inputSchema: {
      type: 'object',
      properties: {
        prefix: {
          type: 'string',
          description: '路径前缀，默认为根目录'
        }
      }
    }
  },
  
  // 统计分析工具
  get_folder_stats: {
    name: 'get_folder_stats',
    description: '获取文件夹统计信息',
    inputSchema: {
      type: 'object',
      properties: {
        folder_path: {
          type: 'string',
          description: '文件夹路径，为空则统计整个存储桶'
        }
      }
    }
  }
};

/**
 * 注册MCP工具列表请求处理器
 * 返回所有可用工具的定义
 */
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: Object.values(tools),
}));

/**
 * 注册MCP工具调用请求处理器
 * 根据工具名称执行相应的COS操作
 * 
 * @param {Object} request - MCP请求对象
 * @param {string} request.params.name - 工具名称
 * @param {Object} request.params.arguments - 工具参数
 * @returns {Promise<Object>} 工具执行结果
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      // 文件上传操作
      case 'upload_file':
        const cleanPath = validateFileExists(args.file_path);
        const result = await cosService.uploadFile(cleanPath, {
          key: args.object_key,
          customDomain: args.custom_domain
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, data: result }, null, 2)
            }
          ]
        };

      case 'upload_multiple':
        // 验证所有文件是否存在
        const uploadPromises = args.files.map(async (file) => {
          const cleanFilePath = validateFileExists(file.file_path);
          return {
            path: cleanFilePath,
            key: file.object_key
          };
        });

        const validatedFiles = await Promise.all(uploadPromises);

        // 参数验证和默认值设置
        const batchConcurrency = args.concurrency ? Math.min(20, Math.max(1, args.concurrency)) : 3;
        const batchMaxRetries = args.max_retries ? Math.max(0, args.max_retries) : 3;

        const uploadResults = await cosService.uploadMultipleFiles(validatedFiles, {
          concurrency: batchConcurrency,
          maxRetries: batchMaxRetries,
          onProgress: (progress) => {
            // 静默处理批量上传进度，避免污染MCP协议
          }
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, data: uploadResults }, null, 2)
            }
          ]
        };

      case 'upload_large_file':
        const cleanLargeFilePath = validateFileExists(args.file_path);

        // 参数验证和默认值设置
        const chunkSize = args.chunk_size ? Math.max(1024 * 1024, args.chunk_size) : 1024 * 1024; // 最小1MB
        const concurrency = args.concurrency ? Math.min(10, Math.max(1, args.concurrency)) : 3; // 1-10之间

        const largeFileResult = await cosService.uploadFile(cleanLargeFilePath, {
          key: args.object_key,
          customDomain: args.custom_domain,
          useSliceUpload: args.force_slice || true,
          chunkSize: chunkSize,
          concurrency: concurrency,
          onProgress: (progress) => {
            // 这里不输出进度日志，避免污染MCP协议
          }
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, data: largeFileResult }, null, 2)
            }
          ]
        };

      case 'get_upload_progress':
        const progressResult = await cosService.getUploadProgress(args.session_id);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, data: progressResult }, null, 2)
            }
          ]
        };

      case 'clear_upload_progress':
        const clearResult = await cosService.clearUploadProgress(args.session_id);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, data: clearResult }, null, 2)
            }
          ]
        };

      case 'manage_temp_files':
        const tempResult = await cosService.manageTempFiles(args.action, {
          type: args.type,
          olderThanDays: args.older_than_days
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, data: tempResult }, null, 2)
            }
          ]
        };

      // URL工具操作
      case 'get_signed_url':
        const urlResult = await cosService.getSignedUrl(args.object_key, args.expire_time);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, data: urlResult }, null, 2)
            }
          ]
        };

      // 列表和查询操作
      case 'list_objects':
        const listResult = await cosService.listObjects(args.prefix || '');
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, data: listResult }, null, 2)
            }
          ]
        };

      // 删除操作
      case 'delete_object':
        const deleteResult = await cosService.deleteObject(args.object_key);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, data: deleteResult }, null, 2)
            }
          ]
        };

      // 文件操作
      case 'copy_object':
        const copyResult = await cosService.copyObject(args.source_key, args.target_key, {
          targetBucket: args.target_bucket
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, data: copyResult }, null, 2)
            }
          ]
        };

      case 'move_object':
        const moveResult = await cosService.moveObject(args.source_key, args.target_key, {
          targetBucket: args.target_bucket
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, data: moveResult }, null, 2)
            }
          ]
        };

      case 'rename_object':
        const renameResult = await cosService.renameObject(args.old_key, args.new_key);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, data: renameResult }, null, 2)
            }
          ]
        };

      // 批量操作
      case 'delete_multiple':
        const batchDeleteResult = await cosService.deleteMultipleObjects(args.object_keys);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, data: batchDeleteResult }, null, 2)
            }
          ]
        };

      // 文件夹管理操作
      case 'create_folder':
        const createFolderResult = await cosService.createFolder(args.folder_path);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, data: createFolderResult }, null, 2)
            }
          ]
        };

      case 'delete_folder':
        const deleteFolderResult = await cosService.deleteFolder(args.folder_path, {
          recursive: args.recursive || false
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, data: deleteFolderResult }, null, 2)
            }
          ]
        };

      case 'list_folders':
        const listFoldersResult = await cosService.listFolders(args.prefix || '');
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, data: listFoldersResult }, null, 2)
            }
          ]
        };

      // 统计分析操作
      case 'get_folder_stats':
        const folderStatsResult = await cosService.getFolderStats(args.folder_path || '');
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, data: folderStatsResult }, null, 2)
            }
          ]
        };

      default:
        throw new Error(`未知工具: ${name}`);
    }
  } catch (error) {
    // 统一错误处理，返回错误信息
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ success: false, error: error.message }, null, 2)
        }
      ],
      isError: true
    };
  }
});

/**
 * 验证本地文件是否存在
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

/**
 * 服务器主函数 - 启动MCP服务器
 * 使用标准输入输出传输进行通信
 */
async function main() {
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    // 只在调试模式下输出启动信息，避免干扰 MCP 协议通信
    if (process.env.MCP_DEBUG) {
      console.error('腾讯云COS MCP服务器已启动');
    }
  } catch (error) {
    console.error('服务器启动失败:', error);
    process.exit(1);
  }
}

/**
 * 程序入口点检查
 * 检查是否直接运行此文件或通过 npx/bin 调用
 * 如果是，则启动服务器
 */
if (process.argv[1] === new URL(import.meta.url).pathname || process.argv[1].endsWith('tx-cos-mcp')) {
  main();
}

// 导出服务器实例供其他模块使用
export default server;