import pg from 'pg';
import { assertDatabaseConfigured, config } from './config.js';

export const pool = new pg.Pool({
  connectionString: config.databaseUrl || undefined,
  ssl: config.dbSsl ? { rejectUnauthorized: false } : undefined,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on('error', (err) => {
  console.error('PostgreSQL 连接池错误：', err.message);
});

export function query(text, params) {
  assertDatabaseConfigured();
  return pool.query(text, params);
}

export async function withTransaction(fn) {
  assertDatabaseConfigured();
  const client = await pool.connect();
  try {
    await client.query('begin');
    const result = await fn(client);
    await client.query('commit');
    return result;
  } catch (err) {
    await client.query('rollback').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
