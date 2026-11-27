import { HttpError } from '../lib/errors.js';

const PG_MESSAGES = {
  '23514': '数据不满足数据库约束',
  '23503': '关联的测点不存在',
  '23505': '数据已存在',
  '22P02': '数据格式不正确',
  '22003': '数值超出数据库允许范围',
};

const CONNECTION_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ENOTFOUND',
  'ETIMEDOUT',
  '57P01',
  '57P03',
]);

export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  if (err instanceof HttpError) {
    return res.status(err.status).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
    });
  }

  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: { code: 'INVALID_JSON', message: '请求体不是有效的 JSON' },
    });
  }

  if (err?.type === 'entity.too.large') {
    return res.status(413).json({
      error: { code: 'PAYLOAD_TOO_LARGE', message: '请求体过大' },
    });
  }

  if (err?.code && PG_MESSAGES[err.code]) {
    return res.status(400).json({
      error: { code: 'DATABASE_CONSTRAINT', message: PG_MESSAGES[err.code] },
    });
  }

  if (err?.code && CONNECTION_CODES.has(err.code)) {
    console.error('数据库连接失败：', err.message);
    return res.status(503).json({
      error: { code: 'DATABASE_UNAVAILABLE', message: '数据库暂时不可用，请稍后重试' },
    });
  }

  console.error('未处理的服务器错误：', err);
  return res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: '服务器内部错误' },
  });
}
