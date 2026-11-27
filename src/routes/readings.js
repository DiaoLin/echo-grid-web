import { Router } from 'express';
import { query, withTransaction } from '../db.js';
import { requireIngestToken } from '../middleware/auth.js';
import { validateBatch, validateReading } from '../lib/validate.js';
import { buildWhere, parseFilters } from '../lib/filters.js';
import { serializeFilters, serializeReading } from '../lib/serialize.js';

const router = Router();

const READING_COLUMNS =
  'r.id, r.point_id, r.location, r.measured_at, r.db, r.period, r.created_at';

async function insertReadings(readings) {
  return withTransaction(async (client) => {
    const inserted = [];

    for (const reading of readings) {
      await client.query(
        `insert into points (point_id, location)
         values ($1, $2)
         on conflict (point_id) do update
           set location = excluded.location, updated_at = now()`,
        [reading.point_id, reading.location],
      );

      const { rows } = await client.query(
        `insert into readings (point_id, location, measured_at, db, period)
         values ($1, $2, $3, $4, $5)
         returning id, point_id, location, measured_at, db, period, created_at`,
        [
          reading.point_id,
          reading.location,
          reading.measured_at,
          reading.db,
          reading.period,
        ],
      );

      inserted.push(rows[0]);
    }

    return inserted;
  });
}

// 单条上报，供 ESP32 / 手机 APP 使用
router.post('/', requireIngestToken, async (req, res, next) => {
  try {
    const reading = validateReading(req.body);
    const [row] = await insertReadings([reading]);
    res.status(201).json({ data: serializeReading(row) });
  } catch (err) {
    next(err);
  }
});

// 批量补传（断网恢复后使用）
router.post('/batch', requireIngestToken, async (req, res, next) => {
  try {
    const readings = validateBatch(req.body);
    const rows = await insertReadings(readings);
    res.status(201).json({
      inserted: rows.length,
      data: rows.map(serializeReading),
    });
  } catch (err) {
    next(err);
  }
});

// 每个测点的最新一条读数
router.get('/latest', async (req, res, next) => {
  try {
    const { rows } = await query(
      `select distinct on (r.point_id) ${READING_COLUMNS}
       from readings r
       order by r.point_id, r.measured_at desc, r.id desc`,
    );
    res.json({ data: rows.map(serializeReading) });
  } catch (err) {
    next(err);
  }
});

// 历史读数，支持 point_id / period / from / to / limit / offset
router.get('/', async (req, res, next) => {
  try {
    const filters = parseFilters(req.query);
    const where = buildWhere(filters);
    const limitIndex = where.params.length + 1;
    const offsetIndex = where.params.length + 2;

    const { rows } = await query(
      `select ${READING_COLUMNS}
       from readings r
       ${where.sql}
       order by r.measured_at asc, r.id asc
       limit $${limitIndex} offset $${offsetIndex}`,
      [...where.params, filters.limit, filters.offset],
    );

    res.json({
      data: rows.map(serializeReading),
      meta: {
        count: rows.length,
        limit: filters.limit,
        offset: filters.offset,
        filters: serializeFilters(filters),
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
