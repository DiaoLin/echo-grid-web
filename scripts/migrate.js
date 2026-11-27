#!/usr/bin/env node
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertDatabaseConfigured } from '../src/config.js';
import { pool } from '../src/db.js';

const migrationsDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'migrations',
);

async function main() {
  assertDatabaseConfigured();

  const client = await pool.connect();
  try {
    // 防止多个实例同时执行迁移
    await client.query("select pg_advisory_lock(hashtext('echo_grid_migrations'))");

    await client.query(`
      create table if not exists schema_migrations (
        name       text primary key,
        applied_at timestamptz not null default now()
      )
    `);

    const files = (await readdir(migrationsDir))
      .filter((file) => file.endsWith('.sql'))
      .sort();

    const { rows } = await client.query('select name from schema_migrations');
    const applied = new Set(rows.map((row) => row.name));

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`跳过 ${file}（已应用）`);
        continue;
      }

      const sql = await readFile(path.join(migrationsDir, file), 'utf8');
      console.log(`应用 ${file}`);

      await client.query('begin');
      try {
        await client.query(sql);
        await client.query('insert into schema_migrations (name) values ($1)', [file]);
        await client.query('commit');
      } catch (err) {
        await client.query('rollback');
        throw err;
      }
    }

    console.log('数据库迁移完成');
  } finally {
    await client
      .query("select pg_advisory_unlock(hashtext('echo_grid_migrations'))")
      .catch(() => {});
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('数据库迁移失败：', err.message);
  process.exitCode = 1;
});
