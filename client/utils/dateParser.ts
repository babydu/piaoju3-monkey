/**
 * 日期解析工具
 * 支持多种日期格式的解析和标准化
 */

/**
 * 解析各种格式的日期字符串
 * @param dateStr 日期字符串
 * @returns 标准化的日期字符串 (YYYY-MM-DD) 或 null
 */
export function parseDate(dateStr: string | null | undefined): string | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  
  const trimmed = dateStr.trim();
  if (!trimmed) return null;
  
  // 尝试各种日期格式
  const patterns = [
    // YYYY年MM月DD日 或 YYYY年M月D日
    {
      regex: /^(\d{4})年(\d{1,2})月(\d{1,2})日?$/,
      handler: (match: RegExpMatchArray) => `${match[1]}-${padZero(match[2])}-${padZero(match[3])}`
    },
    // YYYY/MM/DD 或 YYYY/M/D
    {
      regex: /^(\d{4})[/\\](\d{1,2})[/\\](\d{1,2})$/,
      handler: (match: RegExpMatchArray) => `${match[1]}-${padZero(match[2])}-${padZero(match[3])}`
    },
    // YYYY-MM-DD (标准格式)
    {
      regex: /^(\d{4})-(\d{1,2})-(\d{1,2})$/,
      handler: (match: RegExpMatchArray) => `${match[1]}-${padZero(match[2])}-${padZero(match[3])}`
    },
    // YYYY.MM.DD
    {
      regex: /^(\d{4})\.(\d{1,2})\.(\d{1,2})$/,
      handler: (match: RegExpMatchArray) => `${match[1]}-${padZero(match[2])}-${padZero(match[3])}`
    },
    // YYYY/MM/DD HH:mm 或 YYYY/MM/DD HH:mm:ss (带时间)
    {
      regex: /^(\d{4})[/\\](\d{1,2})[/\\](\d{1,2})\s+\d{1,2}:\d{1,2}(:\d{1,2})?$/,
      handler: (match: RegExpMatchArray) => `${match[1]}-${padZero(match[2])}-${padZero(match[3])}`
    },
    // YYYY-MM-DD HH:mm 或 YYYY-MM-DD HH:mm:ss (带时间)
    {
      regex: /^(\d{4})-(\d{1,2})-(\d{1,2})\s+\d{1,2}:\d{1,2}(:\d{1,2})?$/,
      handler: (match: RegExpMatchArray) => `${match[1]}-${padZero(match[2])}-${padZero(match[3])}`
    },
    // MM/DD/YYYY (美国格式)
    {
      regex: /^(\d{1,2})[/\\](\d{1,2})[/\\](\d{4})$/,
      handler: (match: RegExpMatchArray) => `${match[3]}-${padZero(match[1])}-${padZero(match[2])}`
    },
    // DD/MM/YYYY (欧洲格式)
    {
      regex: /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/,
      handler: (match: RegExpMatchArray) => `${match[3]}-${padZero(match[2])}-${padZero(match[1])}`
    },
    // 中文日期：X月X日 (缺少年份，使用当前年)
    {
      regex: /^(\d{1,2})月(\d{1,2})日$/,
      handler: (match: RegExpMatchArray) => {
        const year = new Date().getFullYear();
        return `${year}-${padZero(match[1])}-${padZero(match[2])}`;
      }
    },
    // YYYY年MM月DD日 HH:mm (带时间)
    {
      regex: /^(\d{4})年(\d{1,2})月(\d{1,2})日\s+\d{1,2}:\d{1,2}(:\d{1,2})?$/,
      handler: (match: RegExpMatchArray) => `${match[1]}-${padZero(match[2])}-${padZero(match[3])}`
    },
  ];
  
  for (const pattern of patterns) {
    const match = trimmed.match(pattern.regex);
    if (match) {
      const result = pattern.handler(match);
      // 验证日期是否有效
      if (isValidDate(result)) {
        return result;
      }
    }
  }
  
  // 尝试使用Date对象解析
  try {
    const date = new Date(trimmed);
    if (!isNaN(date.getTime())) {
      const year = date.getFullYear();
      const month = padZero(String(date.getMonth() + 1));
      const day = padZero(String(date.getDate()));
      return `${year}-${month}-${day}`;
    }
  } catch {
    // 忽略解析错误
  }
  
  return null;
}

/**
 * 补零
 */
function padZero(num: string): string {
  return num.padStart(2, '0');
}

/**
 * 验证日期是否有效
 */
function isValidDate(dateStr: string): boolean {
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);
  
  // 检查月份和日期是否在有效范围内
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  
  // 检查具体日期是否有效
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year &&
         date.getMonth() === month - 1 &&
         date.getDate() === day;
}

/**
 * 格式化日期为显示格式
 * @param dateStr ISO日期字符串
 * @returns 格式化后的日期字符串
 */
export function formatDateDisplay(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
  } catch {
    return '';
  }
}
