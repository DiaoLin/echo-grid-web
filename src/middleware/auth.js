import { timingSafeEqual } from 'node:crypto';
import { config } from '../config.js';

function safeEqual(a, b) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * 配置 INGEST_TOKEN 后，写接口需要携带令牌。
 * 支持 Authorization: Bearer <token> 或 X-API-Key: <token>。
 */
export function requireIngestToken(req, res, next) {
  if (!config.ingestToken) return next();

  const authorization = req.get('authorization') || '';
  const bearer = authorization.toLowerCase().startsWith('bearer ')
    ? authorization.slice(7).trim()
    : '';
  const token = req.get('x-api-key') || bearer;

  if (token && safeEqual(token, config.ingestToken)) return next();

  res.status(401).json({
    error: {
      code: 'UNAUTHORIZED',
      message: '缺少或错误的采集令牌',
    },
  });
}
