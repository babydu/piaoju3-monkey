/**
 * 讯飞推理服务模块
 * 实现HTTP方式的LLM调用（兼容OpenAI格式）
 * 
 * 文档：https://www.xfyun.cn/doc/spark/推理服务-http.html
 * 
 * 认证方式：
 * - HTTP协议：使用Bearer Token认证（APIKey格式为 "apiKey:apiSecret"）
 * - 接口完全兼容OpenAI格式
 */

import https from 'https';
import { getLLMConfig } from '@/config/env';
import { getSupabaseClient } from '../storage/database/supabase-client.js';

// 消息接口（兼容OpenAI格式）
interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// 调用选项
interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
  userId?: string;  // 用户ID，用于检查AI服务设置
}

// 响应接口
interface ChatResponse {
  success: boolean;
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  error?: string;
  aiDisabled?: boolean;  // AI服务已禁用标志
}

/**
 * 检查用户是否启用了AI服务
 * @param userId 用户ID
 * @returns true表示启用，false表示禁用
 */
export async function isAIServiceEnabledForUser(userId?: string): Promise<boolean> {
  if (!userId) {
    // 没有用户ID时默认启用（兼容旧逻辑）
    return true;
  }
  
  try {
    const client = getSupabaseClient();
    const { data: user } = await client
      .from("users")
      .select("preferences")
      .eq("id", userId)
      .single();
    
    const preferences = (user?.preferences as any) || {};
    // 默认启用AI服务（undefined或true都表示启用）
    return preferences?.aiServiceEnabled !== false;
  } catch (error) {
    console.error('[LLM] 检查AI服务设置失败:', error);
    return true; // 出错时默认启用
  }
}

/**
 * 调用讯飞推理服务
 * 使用HTTP协议，兼容OpenAI格式
 */
export async function chatCompletion(
  messages: ChatMessage[],
  options: ChatOptions = {}
): Promise<ChatResponse> {
  // 检查用户是否启用了AI服务
  if (options.userId) {
    const aiEnabled = await isAIServiceEnabledForUser(options.userId);
    if (!aiEnabled) {
      console.log('[LLM] AI服务已禁用，跳过调用');
      return {
        success: false,
        content: '',
        error: 'AI服务已关闭，请在设置中开启',
        aiDisabled: true,
      };
    }
  }

  // 获取配置
  let config;
  try {
    config = getLLMConfig();
  } catch {
    console.error('[LLM] 服务未配置');
    return {
      success: false,
      content: '',
      error: 'LLM服务未配置，请设置环境变量：LLM_MODEL_ID, LLM_API_KEY',
    };
  }

  const {
    temperature = 0.7,
    maxTokens = 2048,
    timeout = 60000,
  } = options;

  try {
    // 解析 URL 获取 host 和 path
    const urlObj = new URL(config.baseUrl);
    const host = urlObj.host;
    const basePath = urlObj.pathname;
    const apiPath = '/chat/completions';
    const fullPath = basePath + apiPath;

    // 构造请求体（OpenAI格式）
    const requestBody = {
      model: config.modelId,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
      temperature,
      max_tokens: maxTokens,
      stream: false,
    };

    console.log('[LLM] 调用讯飞推理服务');
    console.log('[LLM] Host:', host);
    console.log('[LLM] Path:', fullPath);
    console.log('[LLM] Model:', config.modelId);
    console.log('[LLM] 消息数量:', messages.length);

    // 使用 Bearer Token 认证（讯飞推理服务HTTP协议）
    // APIKey格式为 "apiKey:apiSecret"
    const requestBodyStr = JSON.stringify(requestBody);

    const response = await new Promise<string>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('请求超时'));
      }, timeout);

      const requestOptions: https.RequestOptions = {
        hostname: host,
        port: 443,
        path: fullPath,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Length': Buffer.byteLength(requestBodyStr),
        },
      };

      const req = https.request(requestOptions, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          clearTimeout(timeoutId);
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve(data);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        });
      });

      req.on('error', (error) => {
        clearTimeout(timeoutId);
        reject(error);
      });

      req.write(requestBodyStr);
      req.end();
    });

    console.log('[LLM] 原始响应:', response.substring(0, 500));

    // 解析响应
    const result = JSON.parse(response) as {
      choices?: Array<{
        message?: {
          content?: string;
        };
      }>;
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
      };
    };

    const content = result.choices?.[0]?.message?.content || '';
    
    console.log('[LLM] 调用成功，内容长度:', content.length);

    return {
      success: true,
      content,
      usage: result.usage ? {
        promptTokens: result.usage.prompt_tokens || 0,
        completionTokens: result.usage.completion_tokens || 0,
        totalTokens: result.usage.total_tokens || 0,
      } : undefined,
    };
  } catch (error) {
    console.error('[LLM] 调用失败:', error);
    
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    
    return {
      success: false,
      content: '',
      error: errorMessage,
    };
  }
}

/**
 * 流式调用讯飞推理服务
 */
export async function* chatStream(
  messages: ChatMessage[],
  options: ChatOptions = {}
): AsyncGenerator<string, void, unknown> {
  const config = getLLMConfig();

  const {
    temperature = 0.7,
    maxTokens = 2048,
    timeout = 60000,
  } = options;

  const urlObj = new URL(config.baseUrl);
  const host = urlObj.host;
  const basePath = urlObj.pathname;
  const fullPath = basePath + '/chat/completions';

  const requestBody = {
    model: config.modelId,
    messages: messages.map(m => ({
      role: m.role,
      content: m.content,
    })),
    temperature,
    max_tokens: maxTokens,
    stream: true,
  };

  console.log('[LLM] 流式调用讯飞推理服务');

  const requestBodyStr = JSON.stringify(requestBody);

  await new Promise<void>((resolve, reject) => {
    const timeoutId = setTimeout(() => reject(new Error('请求超时')), timeout);

    const requestOptions: https.RequestOptions = {
      hostname: host,
      port: 443,
      path: fullPath,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
        'Accept': 'text/event-stream',
      },
    };

    const req = https.request(requestOptions, (res) => {
      clearTimeout(timeoutId);
      
      let buffer = '';
      
      res.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') return;
            
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                // 在generator中无法直接yield，这里只打印
                process.stdout.write(content);
              }
            } catch {
              // 忽略解析错误
            }
          }
        }
      });
      
      res.on('end', () => resolve());
    });

    req.on('error', (error) => {
      clearTimeout(timeoutId);
      reject(error);
    });

    req.write(requestBodyStr);
    req.end();
  });
}

/**
 * 将中文键名转换为英文键名
 */
function mapKeyInfoToEnglish(keyInfo: Record<string, string>): Record<string, string> {
  const mapping: Record<string, string> = {
    '日期': 'date',
    '时间': 'date',
    '金额': 'amount',
    '地点': 'location',
    '位置': 'location',
    '姓名': 'name',
    '持有人': 'name',
    '编号': 'number',
    '车次': 'number',
    '航班': 'number',
    '航班号': 'number',
  };

  const result: Record<string, string> = {};
  
  for (const [key, value] of Object.entries(keyInfo)) {
    const englishKey = mapping[key] || key.toLowerCase();
    if (value && typeof value === 'string' && value.trim()) {
      result[englishKey] = value.trim();
    }
  }
  
  return result;
}

/**
 * 分析OCR识别结果，提取结构化信息
 * 
 * 返回字段说明：
 * - ticketType: 票据类型（证件、门票、车票、发票、银行卡、其他）
 * - suggestedTitle: 提炼的标题（简短描述，不超过20字，用于票据标题字段）
 * - summary: 票据简介（对OCR内容的整体梳理，以段落形式总结，让用户一眼就能知道该票据是什么内容）
 * - suggestedTags: 建议标签（最多3个）
 * - keyInfo: 关键信息（日期、金额、地点、姓名等）- 使用英文键名
 */
export async function analyzeOCRText(
  ocrText: string,
  options: { timeout?: number; userId?: string } = {}
): Promise<{
  ticketType: string;
  suggestedTitle: string;
  summary: string;
  suggestedTags: string[];
  keyInfo: Record<string, string>;
  aiDisabled?: boolean;
}> {
  const systemPrompt = `你是一个专业的票据识别助手。请仔细分析OCR识别出的文字内容，提取结构化信息。

## 票据类型分类
- 证件：身份证、护照、驾驶证、行驶证、银行卡、社保卡等
- 门票：景区门票、演出票、电影票、展览票等
- 车票：火车票、高铁票、汽车票、机票、船票等
- 发票：增值税发票、收据、购物小票、餐饮发票等
- 银行卡：信用卡、借记卡、储蓄卡等
- 其他：无法归类的票据

## 返回格式（严格JSON）
{
  "ticketType": "票据类型（证件/门票/车票/发票/银行卡/其他）",
  "suggestedTitle": "提炼的标题（不超过20字，简洁明了，如：北京至上海高铁票、故宫门票、增值税发票等）",
  "summary": "票据简介（一段话总结票据核心内容，包含时间、地点、金额等关键要素，让用户一眼就能知道这是什么票据、主要内容是什么，50-100字为宜）",
  "suggestedTags": ["标签1", "标签2", "标签3"],
  "keyInfo": {
    "日期": "具体日期",
    "金额": "具体金额",
    "地点": "具体地点",
    "姓名": "持有人姓名"
  }
}

## 注意事项
1. 返回纯JSON，不要有markdown代码块标记
2. suggestedTitle必须简洁，突出票据核心信息
3. summary要完整描述票据内容，包括：这是什么票据、时间、地点/路线、金额、持有人等关键信息
4. suggestedTags最多3个标签，要准确概括票据特征
5. keyInfo只提取最重要的3-5个信息，没有的字段不要返回
6. 如果OCR内容太少或无法识别，ticketType设为"其他"，summary说明无法识别原因`;

  const userPrompt = `请分析以下OCR识别结果，提取结构化信息：

---
${ocrText}
---

请返回JSON格式的分析结果。`;

  try {
    const response = await chatCompletion(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      { temperature: 0.3, maxTokens: 1024, timeout: options.timeout, userId: options.userId }
    );

    if (!response.success || !response.content) {
      console.error('[LLM] OCR分析失败:', response.error);
      // AI服务关闭时返回空结果，不返回推荐标签
      return {
        ticketType: '其他',
        suggestedTitle: '',
        summary: response.aiDisabled ? '' : '无法分析票据内容',
        suggestedTags: [],
        keyInfo: {},
        aiDisabled: response.aiDisabled || false,
      };
    }

    // 解析JSON响应
    let jsonStr = response.content.trim();
    
    // 去除可能的markdown代码块标记
    if (jsonStr.startsWith('```')) {
      const lines = jsonStr.split('\n');
      if (lines[0].startsWith('```')) {
        lines.shift();
      }
      if (lines[lines.length - 1].startsWith('```')) {
        lines.pop();
      }
      jsonStr = lines.join('\n').trim();
    }

    try {
      const result = JSON.parse(jsonStr);
      // 将中文键名映射为英文键名
      const mappedKeyInfo = mapKeyInfoToEnglish(result.keyInfo || {});
      console.log('[LLM] keyInfo映射:', result.keyInfo, '->', mappedKeyInfo);
      return {
        ticketType: result.ticketType || '其他',
        suggestedTitle: result.suggestedTitle || '',
        summary: result.summary || '',
        suggestedTags: Array.isArray(result.suggestedTags) ? result.suggestedTags : ['其他'],
        keyInfo: mappedKeyInfo,
      };
    } catch (parseError) {
      console.error('[LLM] JSON解析失败:', parseError);
      console.error('[LLM] 原始内容:', jsonStr);
      return {
        ticketType: '其他',
        suggestedTitle: '',
        summary: '票据内容解析失败',
        suggestedTags: ['其他'],
        keyInfo: {},
      };
    }
  } catch (error) {
    console.error('[LLM] OCR分析异常:', error);
    return {
      ticketType: '其他',
      suggestedTitle: '',
      summary: '票据分析服务暂时不可用',
      suggestedTags: ['其他'],
      keyInfo: {},
    };
  }
}

/**
 * 检查LLM服务是否配置
 */
export function isLLMConfigured(): boolean {
  try {
    getLLMConfig();
    return true;
  } catch {
    return false;
  }
}

/**
 * 获取LLM配置信息（用于日志和状态检查）
 */
export function getLLMConfigInfo(): { configured: boolean; message: string } {
  try {
    const config = getLLMConfig();
    return {
      configured: true,
      message: `LLM服务已配置（模型: ${config.modelId}）`,
    };
  } catch (error) {
    return {
      configured: false,
      message: 'LLM服务未配置',
    };
  }
}

// 导出别名，保持向后兼容
export const isLLMServiceAvailable = isLLMConfigured;
export const getLLMServiceStatus = getLLMConfigInfo;
