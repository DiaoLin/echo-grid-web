#!/usr/bin/env node
import { createApp } from './app.js';
import { assertDatabaseConfigured } from './config.js';
import { pool, query } from './db.js';

const app = createApp();

// 监听平台注入的 PORT 变量；本地未设置时回退到 3000
const port = Number(process.env.PORT || 3000);

async function main() {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error(`PORT 无效：${process.env.PORT ?? ''}，应为 1—65535 的整数`);
    process.exitCode = 1;
    await pool.end();
    return;
  }

  try {
    assertDatabaseConfigured();
  } catch (err) {
    console.error(err.message);
    process.exitCode = 1;
    await pool.end();
    return;
  }

  try {
    await query('select 1');
  } catch (err) {
    console.error('无法连接 PostgreSQL，请检查 DATABASE_URL 和数据库是否已启动。');
    console.error(`原因：${err.message}`);
    process.exitCode = 1;
    await pool.end();
    return;
  }

  const server = app.listen(port, () => {
    console.log(`EchoGrid 后端已启动：http://localhost:${port}`);
    console.log(`API 说明：http://localhost:${port}/api`);
  });

  let shuttingDown = false;

  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`收到 ${signal}，正在关闭服务…`);

    server.close(async () => {
      await pool.end();
      console.log('服务已关闭');
      process.exit(0);
    });

    // 兜底：10 秒内没有关闭完成就强制退出
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main();
