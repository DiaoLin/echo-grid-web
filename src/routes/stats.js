import { Router } from 'express';
import { config } from '../config.js';
import { query } from '../db.js';
import { buildWhere, parseFilters } from '../lib/filters.js';
import { serializeFilters } from '../lib/serialize.js';
import { PERIODS, formatInOffset } from '../lib/time.js';

const router = Router();

const round1 = (value) => (value === null || value === undefined
  ? null
  : Math.round(Number(value) * 10) / 10);

function summarize(items) {
  if (!items.length) {
    return {
      count: 0,
      avg_db: null,
      min_db: null,
      max_db: null,
      first_time: null,
      last_time: null,
    };
  }

  const count = items.reduce((sum, item) => sum + item.count, 0);
  const total = items.reduce((sum, item) => sum + item.sum_db, 0);

  const first = items.reduce(
    (min, item) => (!min || item.first_time < min ? item.first_time : min),
    null,
  );
  const last = items.reduce(
    (max, item) => (!max || item.last_time > max ? item.last_time : max),
    null,
  );

  return {
    count,
    avg_db: round1(total / count),
    min_db: round1(Math.min(...items.map((item) => item.min_db))),
    max_db: round1(Math.max(...items.map((item) => item.max_db))),
    first_time: formatInOffset(first, config.tzOffsetMinutes),
    last_time: formatInOffset(last, config.tzOffsetMinutes),
  };
}

const periodOrder = (period) => {
  const index = PERIODS.indexOf(period);
  return index === -1 ? PERIODS.length : index;
};

// 汇总统计：总体、按测点、按时段，便于前端做分时段对比
router.get('/', async (req, res, next) => {
  try {
    const filters = parseFilters(req.query, { withPaging: false });
    const where = buildWhere(filters);

    const { rows } = await query(
      `select r.point_id,
              r.period,
              count(*)::int as count,
              sum(r.db)::float8 as sum_db,
              avg(r.db)::float8 as avg_db,
              min(r.db)::float8 as min_db,
              max(r.db)::float8 as max_db,
              min(r.measured_at) as first_time,
              max(r.measured_at) as last_time
       from readings r
       ${where.sql}
       group by r.point_id, r.period
       order by r.point_id, r.period`,
      where.params,
    );

    const items = rows.map((row) => ({
      point_id: row.point_id,
      period: row.period,
      count: row.count,
      sum_db: row.sum_db,
      avg_db: round1(row.avg_db),
      min_db: round1(row.min_db),
      max_db: round1(row.max_db),
      first_time: row.first_time,
      last_time: row.last_time,
    }));

    const byPoint = new Map();
    const byPeriod = new Map();

    for (const item of items) {
      if (!byPoint.has(item.point_id)) byPoint.set(item.point_id, []);
      byPoint.get(item.point_id).push(item);

      if (!byPeriod.has(item.period)) byPeriod.set(item.period, []);
      byPeriod.get(item.period).push(item);
    }

    const points = [...byPoint.entries()].map(([pointId, pointItems]) => ({
      point_id: pointId,
      ...summarize(pointItems),
      by_period: pointItems
        .sort((a, b) => periodOrder(a.period) - periodOrder(b.period))
        .map((item) => ({ period: item.period, ...summarize([item]) })),
    }));

    const periods = [...byPeriod.entries()]
      .map(([period, periodItems]) => ({ period, ...summarize(periodItems) }))
      .sort((a, b) => periodOrder(a.period) - periodOrder(b.period));

    res.json({
      data: {
        overall: summarize(items),
        points,
        periods,
      },
      meta: { filters: serializeFilters(filters) },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
