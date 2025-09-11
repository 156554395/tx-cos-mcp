#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import fs from 'fs';
import { cosService } from './src/cosService.js';

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

// 定义MCP工具
const tools = {
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
    description: '批量上传多个文件到腾讯云COS',
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
        }
      },
      required: ['files']
    }
  },
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

// 处理工具列表请求
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: Object.values(tools),
}));

// 处理工具调用请求
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'upload_file':
        validateFileExists(args.file_path);
        const result = await cosService.uploadFile(args.file_path, {
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
        const uploadPromises = args.files.map(async (file) => {
          validateFileExists(file.file_path);
          return {
            path: file.file_path,
            key: file.object_key
          };
        });

        const validatedFiles = await Promise.all(uploadPromises);
        const uploadResults = await cosService.uploadMultipleFiles(validatedFiles);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, data: uploadResults }, null, 2)
            }
          ]
        };

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

function validateFileExists(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`文件不存在: ${filePath}`);
  }

  const stats = fs.statSync(filePath);
  if (!stats.isFile()) {
    throw new Error(`路径不是文件: ${filePath}`);
  }
}

// 启动服务器
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

// 检查是否直接运行此文件或通过 npx/bin 调用
if (process.argv[1] === new URL(import.meta.url).pathname || process.argv[1].endsWith('tx-cos-mcp')) {
  main();
}

export default server;