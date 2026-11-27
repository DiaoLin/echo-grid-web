import { config } from '../config.js';
import { ValidationError } from './errors.js';

export const PERIODS = Object.freeze(['课间', '午休', '放学']);

const pad = (value) => String(value).padStart(2, '0');

/** 把分钟偏移格式化为 +08:00 这样的时区后缀 */
export function offsetSuffix(offsetMinutes) {
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMinutes);
  return `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

/**
 * 解析上报时间。
 * 支持 ISO 8601、"YYYY-MM-DD HH:mm:ss" 和 "YYYY-MM-DD"。
 * 没有携带时区的时间按 APP_TZ_OFFSET 解释（默认 +08:00）。
 */
export function parseMeasuredAt(value, field = 'time') {
  if (value === undefined || value === null || value === '') return new Date();
  if (typeof value !== 'string') {
    throw new ValidationError(`${field} 必须是字符串`);
  }

  let text = value.trim();
  if (!text) return new Date();

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    text += 'T00:00:00';
  } else {
    text = text.replace(' ', 'T');
  }

  if (!/(?:Z|[+-]\d{2}:?\d{2})$/i.test(text)) {
    text += offsetSuffix(config.tzOffsetMinutes);
  }

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) {
    throw new ValidationError(`${field} 不是有效时间：${value}`);
  }
  return date;
}

/** 按固定偏移输出时间，例如 2026-12-05T10:30:00+08:00 */
export function formatInOffset(date, offsetMinutes = config.tzOffsetMinutes) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;

  const shifted = new Date(date.getTime() + offsetMinutes * 60_000);
  const suffix = offsetSuffix(offsetMinutes);
  return (
    `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}` +
    `T${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}:${pad(shifted.getUTCSeconds())}` +
    suffix
  );
}

export function parsePeriod(value, field = 'period') {
  const period = typeof value === 'string' ? value.trim() : '';
  if (!PERIODS.includes(period)) {
    throw new ValidationError(`${field} 必须是：${PERIODS.join(' / ')}`);
  }
  return period;
}

/**
 * 上报未带 period 时按时段推断：
 * 12:00—13:59 为午休，17:00 以后为放学，其余为课间。
 */
export function inferPeriod(date) {
  const shifted = new Date(date.getTime() + config.tzOffsetMinutes * 60_000);
  const minutes = shifted.getUTCHours() * 60 + shifted.getUTCMinutes();

  if (minutes >= 12 * 60 && minutes < 14 * 60) return '午休';
  if (minutes >= 17 * 60) return '放学';
  return '课间';
}
