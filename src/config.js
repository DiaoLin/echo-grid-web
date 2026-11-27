import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const srcDir = path.dirname(fileURLToPath(import.meta.url));

export const rootDir = path.resolve(srcDir, '..');
export const publicDir = path.join(rootDir, 'public');

// 优先读取当前工作目录的 .env；作为依赖安装时再回退到包目录的 .env
dotenv.config({ quiet: true });
dotenv.config({ path: path.join(rootDir, '.env'), quiet: true });

function readInt(name, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;

  const value = Number.parseInt(raw, 10);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`环境变量 ${name} 必须是 ${min}—${max} 之间的整数，当前为 ${raw}`);
  }
  return value;
}

function readBool(name, fallback = false) {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(raw.trim().toLowerCase());
}

export function parseTzOffset(raw) {
  const text = String(raw).trim();
  const match = /^([+-])(\d{1,2})(?::?(\d{2}))?$/.exec(text);
  if (!match) {
    throw new Error(`APP_TZ_OFFSET 格式无效：${raw}，应形如 +08:00`);
  }

  const sign = match[1] === '-' ? -1 : 1;
  const hours = Number(match[2]);
  const minutes = Number(match[3] ?? 0);
  if (hours > 14 || minutes > 59) {
    throw new Error(`APP_TZ_OFFSET 超出范围：${raw}`);
  }

  return sign * (hours * 60 + minutes);
}

export const config = {
  databaseUrl: process.env.DATABASE_URL?.trim() || '',
  dbSsl: readBool('PGSSL', false),
  ingestToken: process.env.INGEST_TOKEN?.trim() || '',
  corsOrigins: (process.env.CORS_ORIGIN || '*')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean),
  tzOffsetMinutes: parseTzOffset(process.env.APP_TZ_OFFSET || '+08:00'),
  onlineWindowMinutes: readInt('ONLINE_WINDOW_MINUTES', 5, { min: 1, max: 1440 }),
  defaultLimit: readInt('DEFAULT_LIMIT', 200, { min: 1, max: 5000 }),
  maxLimit: readInt('MAX_LIMIT', 5000, { min: 1, max: 50000 }),
  maxExportRows: readInt('MAX_EXPORT_ROWS', 100000, { min: 1 }),
};

const PG_ENV_KEYS = ['PGHOST', 'PGPORT', 'PGDATABASE', 'PGUSER', 'PGPASSWORD'];

/** 是否通过环境变量显式配置了外部数据库 */
export function hasDatabaseConfig() {
  return Boolean(config.databaseUrl)
    || PG_ENV_KEYS.some((key) => Boolean(process.env[key]?.trim()));
}

/**
 * 本项目不自带数据库，也不提供默认连接配置。
 * 启动服务和执行迁移前必须显式配置 DATABASE_URL 或标准 PG* 变量。
 */
export function assertDatabaseConfigured() {
  if (!hasDatabaseConfig()) {
    throw new Error(
      '未配置数据库连接：请在 .env 中设置 DATABASE_URL，'
      + '或设置 PGHOST / PGPORT / PGDATABASE / PGUSER / PGPASSWORD',
    );
  }
}

