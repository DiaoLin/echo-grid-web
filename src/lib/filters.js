import { config } from '../config.js';
import { ValidationError } from './errors.js';
import { parseMeasuredAt, parsePeriod } from './time.js';

function parseInteger(value, field, min, max) {
  const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (!Number.isInteger(number) || number < min || number > max) {
    throw new ValidationError(`${field} 必须是 ${min}—${max} 之间的整数`);
  }
  return number;
}

/** 解析 GET 查询中的过滤条件 */
export function parseFilters(query, { withPaging = true } = {}) {
  const pointIdRaw = query.point_id;
  const pointId = pointIdRaw === undefined ? '' : String(pointIdRaw).trim();
  if (pointId.length > 32) {
    throw new ValidationError('point_id 最长 32 个字符');
  }

  const period = query.period ? parsePeriod(String(query.period)) : null;
  const from = query.from ? parseMeasuredAt(String(query.from), 'from') : null;
  const to = query.to ? parseMeasuredAt(String(query.to), 'to') : null;

  if (from && to && from.getTime() > to.getTime()) {
    throw new ValidationError('from 不能晚于 to');
  }

  let limit = null;
  let offset = 0;

  if (withPaging) {
    const maxLimit = config.maxLimit;
    const defaultLimit = Math.min(config.defaultLimit, maxLimit);
    limit = query.limit === undefined
      ? defaultLimit
      : parseInteger(query.limit, 'limit', 1, maxLimit);
    offset = query.offset === undefined
      ? 0
      : parseInteger(query.offset, 'offset', 0, 10_000_000);
  }

  return {
    pointId: pointId || null,
    period,
    from,
    to,
    limit,
    offset,
  };
}

/** 生成读数查询的 WHERE 子句与参数，供列表 / 统计 / 导出复用 */
export function buildWhere(filters, alias = 'r') {
  const clauses = [];
  const params = [];

  if (filters.pointId) {
    params.push(filters.pointId);
    clauses.push(`${alias}.point_id = $${params.length}`);
  }
  if (filters.period) {
    params.push(filters.period);
    clauses.push(`${alias}.period = $${params.length}`);
  }
  if (filters.from) {
    params.push(filters.from);
    clauses.push(`${alias}.measured_at >= $${params.length}`);
  }
  if (filters.to) {
    params.push(filters.to);
    clauses.push(`${alias}.measured_at <= $${params.length}`);
  }

  return {
    sql: clauses.length ? `where ${clauses.join(' and ')}` : '',
    params,
  };
}
