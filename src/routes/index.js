import { Router } from 'express';
import { config } from '../config.js';
import { query } from '../db.js';
import readings from './readings.js';
import points from './points.js';
import stats from './stats.js';
import exportCsv from './export.js';

const router = Router();

router.get('/', (req, res) => {
  res.json({
    name: 'EchoGrid API',
    version: '0.1.0',
    endpoints: {
      health: 'GET /api/health',
      createReading: 'POST /api/readings',
      createReadingsBatch: 'POST /api/readings/batch',
      listReadings: 'GET /api/readings?point_id=&period=&from=&to=&limit=&offset=',
      latestReadings: 'GET /api/readings/latest',
      listPoints: 'GET /api/points',
      stats: 'GET /api/stats?point_id=&period=&from=&to=',
      exportCsv: 'GET /api/export.csv?point_id=&period=&from=&to=',
    },
    periods: ['课间', '午休', '放学'],
    timezone: `UTC${config.tzOffsetMinutes >= 0 ? '+' : '-'}${String(
      Math.floor(Math.abs(config.tzOffsetMinutes) / 60),
    ).padStart(2, '0')}:${String(Math.abs(config.tzOffsetMinutes) % 60).padStart(2, '0')}`,
  });
});

router.get('/health', async (req, res) => {
  try {
    const { rows } = await query('select now() as now');
    res.json({
      status: 'ok',
      database: 'ok',
      time: rows[0].now,
      uptime_seconds: Math.round(process.uptime()),
    });
  } catch (err) {
    res.status(503).json({
      status: 'error',
      database: 'unavailable',
      message: err.message,
    });
  }
});

router.use('/readings', readings);
router.use('/points', points);
router.use('/stats', stats);
router.use('/export.csv', exportCsv);

// /api 下未匹配的路径统一返回 JSON 404
router.use((req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `接口不存在：${req.method} ${req.originalUrl}`,
    },
  });
});

export default router;
