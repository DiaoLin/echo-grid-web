import fs from 'node:fs';
import path from 'node:path';
import cors from 'cors';
import express from 'express';
import { config, publicDir } from './config.js';
import apiRouter from './routes/index.js';
import { errorHandler } from './middleware/error.js';
import { requestLogger } from './middleware/logger.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(cors({
    origin: config.corsOrigins.includes('*') ? '*' : config.corsOrigins,
  }));
  app.use(express.json({ limit: '1mb' }));
  app.use(requestLogger);

  app.use('/api', apiRouter);

  // 前端静态文件统一放在 web/public
  app.use(express.static(publicDir, { index: 'index.html' }));

  // 前端尚未部署时，根路径返回接口说明；部署后自动返回 index.html
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();

    const indexFile = path.join(publicDir, 'index.html');
    if (fs.existsSync(indexFile)) {
      return res.sendFile(indexFile);
    }

    if (req.path === '/') {
      return res.json({
        name: 'EchoGrid API',
        message: '后端已启动。前端文件放入 web/public 后即可访问。',
        api: '/api',
        health: '/api/health',
      });
    }

    return res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: '前端尚未部署：请将网页文件放入 web/public（例如 index.html）。',
      },
    });
  });

  app.use(errorHandler);

  return app;
}
