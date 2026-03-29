/**
 * 环境变量安全配置加载器
 * 
 * 设计原则：
 * 1. 支持多种环境变量命名格式
 * 2. 运行时密钥验证和安全检查
 * 3. 避免密钥在日志中泄露
 * 4. 支持开发环境和生产环境
 * 
 * 注意：扣子平台环境变量不能以 COZE_ 开头
 */

import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

// 环境变量是否已加载
let envLoaded = false;

// 扣子平台环境变量是否可用
let cozeEnvAvailable = false;

/**
 * 从扣子平台加载环境变量
 * 使用 coze_workload_identity SDK 获取平台配置的环境变量
 */
function loadCozeEnvVars(): void {
  if (cozeEnvAvailable) return;
  
  try {
    const pythonCode = `
import os
import sys
try:
    from coze_workload_identity import Client
    client = Client()
    env_vars = client.get_project_env_vars()
    client.close()
    for env_var in env_vars:
        print(f"{env_var.key}={env_var.value}")
except Exception as e:
    print(f"# Error: {e}", file=sys.stderr)
`;

    const output = execSync(`python3 -c '${pythonCode.replace(/'/g, "'\"'\"'")}'`, {
      encoding: 'utf-8',
      timeout: 10000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const lines = output.trim().split('\n');
    for (const line of lines) {
      if (line.startsWith('#')) continue;
      const eqIndex = line.indexOf('=');
      if (eqIndex > 0) {
        const key = line.substring(0, eqIndex);
        let value = line.substring(eqIndex + 1);
        if ((value.startsWith("'") && value.endsWith("'")) ||
            (value.startsWith('"') && value.endsWith('"'))) {
          value = value.slice(1, -1);
        }
        // 扣子平台环境变量优先级最高，总是覆盖
        process.env[key] = value;
      }
    }
    
    cozeEnvAvailable = true;
    console.log('[Config] 扣子平台环境变量加载成功');
  } catch (error) {
    // 扣子平台环境变量不可用，使用本地配置
    console.log('[Config] 使用本地环境变量配置');
  }
}

/**
 * 简单的 .env 文件解析器（同步）
 * 支持 # 注释和基本的 key=value 格式
 */
function parseEnvFile(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  const lines = content.split('\n');
  
  for (const line of lines) {
    // 跳过空行和注释
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex > 0) {
      const key = trimmed.substring(0, eqIndex).trim();
      let value = trimmed.substring(eqIndex + 1).trim();
      
      // 移除引号
      if ((value.startsWith("'") && value.endsWith("'")) ||
          (value.startsWith('"') && value.endsWith('"'))) {
        value = value.slice(1, -1);
      }
      
      result[key] = value;
    }
  }
  
  return result;
}

/**
 * 加载 .env 文件（开发环境）
 */
function loadDotEnv(): void {
  // 尝试多个可能的 .env 文件位置
  const envPaths = [
    resolve(process.cwd(), '.env'),
    resolve(process.cwd(), 'server', '.env'),
  ];
  
  for (const envPath of envPaths) {
    if (existsSync(envPath)) {
      try {
        const content = readFileSync(envPath, 'utf-8');
        const envVars = parseEnvFile(content);
        
        for (const [key, value] of Object.entries(envVars)) {
          // 只设置未定义的环境变量
          if (process.env[key] === undefined) {
            process.env[key] = value;
          }
        }
        
        console.log(`[Config] 已加载环境变量文件: ${envPath}`);
        return;
      } catch (error) {
        console.warn(`[Config] 加载 .env 文件失败: ${envPath}`);
      }
    }
  }
}

/**
 * 初始化环境变量
 * 按优先级加载：扣子平台环境变量 > .env文件
 */
export function initEnv(): void {
  if (envLoaded) return;
  
  // 1. 先尝试加载扣子平台环境变量
  loadCozeEnvVars();
  
  // 2. 加载 .env 文件作为补充
  loadDotEnv();
  
  envLoaded = true;
}

/**
 * 获取环境变量的值
 * 支持多种命名格式的回退查找
 * 
 * @param keys - 按优先级排列的环境变量名列表
 * @param defaultValue - 默认值
 * @returns 环境变量的值
 */
export function getEnvValue(keys: string[], defaultValue: string = ''): string {
  initEnv();
  
  for (const key of keys) {
    const value = process.env[key];
    if (value && value.trim()) {
      return value.trim();
    }
  }
  
  return defaultValue;
}

/**
 * 获取必填的环境变量
 * 如果不存在则抛出异常
 */
export function getRequiredEnvValue(keys: string[], description: string): string {
  const value = getEnvValue(keys);
  if (!value) {
    throw new Error(`环境变量缺失: ${keys.join(' 或 ')} (${description})`);
  }
  return value;
}

/**
 * 检查环境变量是否已配置
 */
export function isEnvConfigured(keys: string[]): boolean {
  return !!getEnvValue(keys);
}

/**
 * 脱敏显示环境变量（用于日志）
 * 只显示前4位和后4位，中间用****替代
 */
export function maskEnvValue(value: string): string {
  if (!value || value.length <= 8) {
    return '****';
  }
  return value.substring(0, 4) + '****' + value.substring(value.length - 4);
}

/**
 * OCR服务配置接口
 */
export interface OCRConfig {
  host: string;        // 服务地址
  appId: string;       // 应用ID
  apiKey: string;      // API密钥
  apiSecret: string;   // API密钥
}

/**
 * LLM服务配置接口
 */
export interface LLMConfig {
  baseUrl: string;     // 服务地址
  modelId: string;     // 模型ID
  apiKey: string;      // API密钥
  apiSecret: string;   // API密钥（用于HMAC签名）
}

/**
 * 获取OCR服务配置
 * 支持的环境变量命名：
 * - 标准命名：OCR_HOST, OCR_APP_ID, OCR_API_KEY, OCR_API_SECRET
 * - 简化命名：ocr_address, ocr_api, ocr_secret
 */
export function getOCRConfig(): OCRConfig {
  initEnv();
  
  const host = getEnvValue(
    ['OCR_HOST', 'ocr_address'],
    'api.xf-yun.com'
  );
  
  const appId = getRequiredEnvValue(
    ['OCR_APP_ID'],
    'OCR应用ID'
  );
  
  const apiKey = getRequiredEnvValue(
    ['OCR_API_KEY', 'OCR_API', 'ocr_api'],
    'OCR API密钥'
  );
  
  const apiSecret = getRequiredEnvValue(
    ['OCR_API_SECRET', 'OCR_SECRET', 'ocr_secret'],
    'OCR API密钥'
  );
  
  return { host, appId, apiKey, apiSecret };
}

/**
 * 获取LLM服务配置
 * 支持的环境变量命名：
 * - 标准命名：LLM_BASE_URL, LLM_MODEL_ID, LLM_API_KEY
 * - 扣子平台命名：MODEL_ID, MODELS_API, LLM_API_SECRET, MODELS_HOST
 * - 备用命名：MODELS_ID, MODELS_API_KEY, models_id, models_api
 * 
 * 讯飞推理服务HTTP协议说明：
 * - 接口地址：https://maas-api.cn-huabei-1.xf-yun.com/v2
 * - APIKey格式：apiKey:apiSecret（冒号分隔的组合字符串）
 * - 认证方式：Bearer Token（兼容OpenAI格式）
 */
export function getLLMConfig(): LLMConfig {
  initEnv();
  
  // 获取模型ID（支持 MODEL_ID 和 MODELS_ID 两种命名，MODEL_ID 优先级最高）
  // 注意：扣子平台配置的是 MODEL_ID，而 LLM_MODEL_ID 可能是旧配置
  const llmModelId = getEnvValue(['MODEL_ID', 'LLM_MODEL_ID', 'MODELS_ID', 'models_id']);
  
  // 获取 API Key（可能是组合格式 "apiKey:apiSecret" 或单独的 apiKey）
  const rawApiKey = getEnvValue(['LLM_API_KEY', 'MODELS_API_KEY', 'MODELS_API', 'models_api']);
  
  // 获取单独的 API Secret
  const llmApiSecret = getEnvValue(['LLM_API_SECRET', 'MODELS_API_SECRET', 'MODELS_SECRET', 'models_secret']);
  
  // 组合 API Key：如果 rawApiKey 不包含冒号，且有单独的 apiSecret，则组合成 "apiKey:apiSecret" 格式
  let llmApiKey = rawApiKey;
  if (rawApiKey && !rawApiKey.includes(':') && llmApiSecret) {
    llmApiKey = `${rawApiKey}:${llmApiSecret}`;
    console.log('[Config] 已组合 API Key 和 Secret');
  }
  
  if (llmApiKey && llmModelId) {
    // 使用讯飞推理服务
    const baseUrl = getEnvValue(
      ['LLM_BASE_URL', 'MODELS_HOST', 'models_address'],
      'https://maas-api.cn-huabei-1.xf-yun.com/v2'
    );
    
    console.log('[Config] 使用讯飞推理服务 HTTP协议');
    console.log('[Config] baseUrl:', baseUrl);
    console.log('[Config] modelId:', llmModelId);
    console.log('[Config] apiKey:', maskEnvValue(llmApiKey));
    
    return { 
      baseUrl, 
      modelId: llmModelId, 
      apiKey: llmApiKey,
      apiSecret: llmApiSecret || '',
    };
  }
  
  // 配置不完整
  throw new Error('LLM服务配置不完整，请设置：LLM_MODEL_ID (或 MODEL_ID), LLM_API_KEY (或 MODELS_API)');
}

/**
 * 检查OCR服务是否已配置
 */
export function isOCRConfigured(): boolean {
  initEnv();
  return (
    isEnvConfigured(['OCR_APP_ID']) &&
    isEnvConfigured(['OCR_API_KEY', 'OCR_API', 'ocr_api']) &&
    isEnvConfigured(['OCR_API_SECRET', 'OCR_SECRET', 'ocr_secret'])
  );
}

/**
 * 检查LLM服务是否已配置
 */
export function isLLMConfigured(): boolean {
  initEnv();
  // 检查讯飞推理服务配置（需要 apiKey 和 modelId）
  return (
    isEnvConfigured(['LLM_MODEL_ID', 'MODELS_ID', 'models_id']) &&
    isEnvConfigured(['LLM_API_KEY', 'MODELS_API_KEY', 'MODELS_API', 'models_api'])
  );
}

/**
 * 获取配置状态报告（用于健康检查，不暴露敏感信息）
 */
export function getConfigStatus(): {
  ocr: { configured: boolean; message: string };
  llm: { configured: boolean; message: string };
} {
  initEnv();
  
  return {
    ocr: {
      configured: isOCRConfigured(),
      message: isOCRConfigured() 
        ? 'OCR服务已配置' 
        : '缺少OCR配置：OCR_APP_ID, OCR_API_KEY, OCR_API_SECRET',
    },
    llm: {
      configured: isLLMConfigured(),
      message: isLLMConfigured()
        ? 'LLM服务已配置'
        : '缺少LLM配置：LLM_MODEL_ID, LLM_API_KEY',
    },
  };
}

// 自动初始化
initEnv();
