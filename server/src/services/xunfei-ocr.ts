/**
 * 讯飞OCR服务模块
 * 实现HTTP方式的通用文字识别
 * 
 * 安全策略：
 * 1. API密钥通过统一的环境变量加载器获取
 * 2. 服务端生成签名，前端无法获取密钥
 * 3. 签名有时效性（最大允许300秒的偏差）
 */

import crypto from 'crypto';
import { 
  getOCRConfig, 
  isOCRConfigured, 
  maskEnvValue,
  type OCRConfig 
} from '@/config/env';

// OCR识别结果接口
interface OCRPage {
  exception: number;
  width: number;
  height: number;
  angle: number;
  lines: Array<{
    exception: number;
    angle: number;
    conf: number;
    words: Array<{
      conf: number;
      content: string;
    }>;
    word_units?: Array<{
      content: string;
      conf: number;
    }>;
  }>;
}

interface OCRResult {
  pages: OCRPage[];
  category: string;
  version: string;
}

// HTTP响应接口
interface HTTPResponse {
  header: {
    code: number;
    message: string;
    sid: string;
  };
  payload?: {
    result: {
      compress: string;
      encoding: string;
      format: string;
      text: string; // Base64编码的结果
    };
  };
}

// 缓存的配置
let cachedConfig: OCRConfig | null = null;

/**
 * 获取讯飞OCR配置（带缓存）
 */
function getXunfeiConfig(): OCRConfig {
  if (cachedConfig) {
    return cachedConfig;
  }
  
  cachedConfig = getOCRConfig();
  
  // 日志输出（脱敏）
  console.log('[OCR] 配置加载完成:', {
    host: cachedConfig.host,
    appId: maskEnvValue(cachedConfig.appId),
    apiKey: maskEnvValue(cachedConfig.apiKey),
    apiSecret: maskEnvValue(cachedConfig.apiSecret),
  });
  
  return cachedConfig;
}

/**
 * 生成讯飞HTTP鉴权URL
 * 使用HMAC-SHA256签名
 */
function generateAuthUrl(config: OCRConfig): string {
  const { apiKey, apiSecret, host } = config;
  const path = '/v1/private/sf8e6aca1';
  
  // 生成RFC1123格式的时间戳（UTC时间）
  const date = new Date().toUTCString();
  
  // 构造签名字符串（注意：使用POST方法，且末尾要加 HTTP/1.1）
  // 格式：host: $host\ndate: $date\n$request-line
  const signatureOrigin = `host: ${host}\ndate: ${date}\nPOST ${path} HTTP/1.1`;
  
  // 使用HMAC-SHA256生成签名
  const signature = crypto
    .createHmac('sha256', apiSecret)
    .update(signatureOrigin)
    .digest('base64');
  
  // 构造鉴权参数（authorization_origin）
  const authorizationOrigin = `api_key="${apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`;
  
  // Base64编码鉴权参数
  const authorization = Buffer.from(authorizationOrigin).toString('base64');
  
  // 构造完整的HTTP URL（需要对date进行URL编码）
  const httpUrl = `https://${host}${path}?authorization=${authorization}&date=${encodeURIComponent(date)}&host=${host}`;
  
  return httpUrl;
}

/**
 * 调用讯飞OCR识别图片
 * @param imageBase64 图片的Base64编码（不含data:xxx;base64,前缀）
 * @param timeout 超时时间（毫秒）
 * @returns OCR识别结果
 */
export async function recognizeImage(
  imageBase64: string,
  timeout: number = 30000
): Promise<{ success: boolean; text: string; raw?: OCRResult; error?: string }> {
  // 检查配置是否可用
  if (!isOCRConfigured()) {
    console.error('[OCR] 服务未配置');
    return {
      success: false,
      text: '',
      error: 'OCR服务未配置，请设置环境变量：OCR_APP_ID, OCR_API_KEY, OCR_API_SECRET',
    };
  }
  
  const config = getXunfeiConfig();
  const url = generateAuthUrl(config);
  
  try {    
    // 构造请求体
    const requestBody = {
      header: {
        app_id: config.appId,
        status: 3, // 一次传完
      },
      parameter: {
        sf8e6aca1: {
          category: 'ch_en_public_cloud', // 中英文识别
          result: {
            encoding: 'utf8',
            compress: 'raw',
            format: 'json',
          },
        },
      },
      payload: {
        sf8e6aca1_data_1: {
          encoding: 'jpg',
          status: 3,
          image: imageBase64,
        },
      },
    };

    // 创建AbortController用于超时控制
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[OCR] HTTP错误:', response.status, errorText);
      return {
        success: false,
        text: '',
        error: `OCR服务请求失败: HTTP ${response.status}`,
      };
    }

    const result = await response.json() as HTTPResponse;

    // 检查响应状态
    if (result.header.code !== 0) {
      console.error('[OCR] 业务错误:', result.header.code, result.header.message);
      return {
        success: false,
        text: '',
        error: `OCR识别失败: ${result.header.message} (code: ${result.header.code})`,
      };
    }

    // 解析识别结果
    if (!result.payload?.result?.text) {
      return {
        success: false,
        text: '',
        error: 'OCR识别结果为空',
      };
    }

    // Base64解码识别结果
    const resultText = Buffer.from(result.payload.result.text, 'base64').toString('utf-8');
    const ocrResult: OCRResult = JSON.parse(resultText);

    // 提取所有文字
    let text = '';
    if (ocrResult.pages) {
      for (const page of ocrResult.pages) {
        if (page.lines) {
          for (const line of page.lines) {
            if (line.words) {
              for (const word of line.words) {
                text += word.content;
              }
            }
            text += '\n';
          }
        }
      }
    }

    return {
      success: true,
      text: text.trim(),
      raw: ocrResult,
    };
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return {
          success: false,
          text: '',
          error: 'OCR识别超时',
        };
      }
      console.error('[OCR] 调用失败:', error);
      return {
        success: false,
        text: '',
        error: `OCR服务调用失败: ${error.message}`,
      };
    }
    return {
      success: false,
      text: '',
      error: 'OCR服务调用失败: 未知错误',
    };
  }
}

/**
 * 检查讯飞OCR服务是否可用
 */
export function isOCRServiceAvailable(): boolean {
  return isOCRConfigured();
}

/**
 * 获取OCR服务状态信息（不暴露密钥）
 */
export function getOCRServiceStatus(): { available: boolean; message: string } {
  if (!isOCRConfigured()) {
    return { 
      available: false, 
      message: '缺少OCR配置。请设置环境变量：\n' +
        '  - OCR_APP_ID (应用ID)\n' +
        '  - OCR_API_KEY 或 ocr_api (API密钥)\n' +
        '  - OCR_API_SECRET 或 ocr_secret (API密钥)'
    };
  }
  
  return { available: true, message: 'OCR服务已就绪' };
}
