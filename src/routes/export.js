import { Router } from 'express';
import { config } from '../config.js';
import { query } from '../db.js';
import { buildWhere, parseFilters } from '../lib/filters.js';
import { toCsv } from '../lib/csv.js';
import { HttpError } from '../lib/errors.js';
import { formatInOffset } from '../lib/time.js';

const router = Router();

// 导出 CSV，表头与 README 一致：point_id,location,time,db,period
router.get('/', async (req, res, next) => {
  try {
    const filters = parseFilters(req.query, { withPaging: false });
    const where = buildWhere(filters);
    const limitIndex = where.params.length + 1;

    const { rows } = await query(
      `select r.point_id, r.location, r.measured_at, r.db, r.period
       from readings r
       ${where.sql}
       order by r.measured_at asc, r.id asc
       limit $${limitIndex}`,
      [...where.params, config.maxExportRows + 1],
    );

    if (rows.length > config.maxExportRows) {
      throw new HttpError(
        413,
        'EXPORT_TOO_LARGE',
        `导出数据超过 ${config.maxExportRows} 行，请缩小时间范围或按测点筛选`,
      );
    }

    const csv = toCsv(rows.map((row) => ({
      point_id: row.point_id,
      location: row.location,
      time: formatInOffset(row.measured_at, config.tzOffsetMinutes),
      db: row.db,
      period: row.period,
    })));

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="echo-grid-readings.csv"',
    );
    // BOM 让 Excel 正确识别 UTF-8 中文
    res.send(`\uFEFF${csv}`);
  } catch (err) {
    next(err);
  }
});

export default router;
