import { ValidationError } from './errors.js';
import { inferPeriod, parseMeasuredAt, parsePeriod } from './time.js';

const POINT_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

function normalizeText(value, field, { max, pattern } = {}) {
  if (typeof value !== 'string') {
    throw new ValidationError(`${field} 必须是字符串`);
  }

  const text = value.trim();
  if (!text) {
    throw new ValidationError(`${field} 不能为空`);
  }
  if (max && text.length > max) {
    throw new ValidationError(`${field} 最长 ${max} 个字符`);
  }
  if (pattern && !pattern.test(text)) {
    throw new ValidationError(`${field} 只能包含字母、数字、下划线和短横线`);
  }
  return text;
}

function normalizeDb(value, field) {
  const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (typeof number !== 'number' || !Number.isFinite(number)) {
    throw new ValidationError(`${field} 必须是数字`);
  }
  if (number < 0 || number > 200) {
    throw new ValidationError(`${field} 必须在 0—200 之间`);
  }
  return Math.round(number * 10) / 10;
}

/** 校验单条读数，字段与 README 的 JSON 格式一致 */
export function validateReading(input, index) {
  const prefix = index === undefined ? '' : `第 ${index + 1} 条：`;

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new ValidationError(`${prefix}数据必须是 JSON 对象`);
  }

  const pointId = normalizeText(input.point_id, `${prefix}point_id`, {
    max: 32,
    pattern: POINT_ID_PATTERN,
  });
  const location = normalizeText(input.location, `${prefix}location`, { max: 128 });
  const db = normalizeDb(input.db, `${prefix}db`);
  const measuredAt = parseMeasuredAt(input.time, `${prefix}time`);

  const period = input.period === undefined || input.period === null || input.period === ''
    ? inferPeriod(measuredAt)
    : parsePeriod(input.period, `${prefix}period`);

  return {
    point_id: pointId,
    location,
    db,
    measured_at: measuredAt,
    period,
  };
}

/** 批量上报：请求体为数组，或 { "readings": [...] } */
export function validateBatch(body) {
  const list = Array.isArray(body) ? body : body?.readings;

  if (!Array.isArray(list)) {
    throw new ValidationError('请求体应为数组，或 {"readings": [...]}');
  }
  if (list.length === 0) {
    throw new ValidationError('批量上报不能为空');
  }
  if (list.length > 1000) {
    throw new ValidationError('单次最多上报 1000 条');
  }

  return list.map((item, index) => validateReading(item, index));
}
