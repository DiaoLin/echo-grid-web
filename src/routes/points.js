import { Router } from 'express';
import { config } from '../config.js';
import { query } from '../db.js';
import { serializePoint } from '../lib/serialize.js';

const router = Router();

// 测点列表 + 最新状态
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await query(
      `select p.point_id,
              p.location,
              p.created_at,
              p.updated_at,
              l.measured_at as last_time,
              l.db as last_db,
              l.period as last_period,
              (l.created_at is not null
                and l.created_at >= now() - make_interval(mins => $1)) as online
       from points p
       left join lateral (
         select r.measured_at, r.db, r.period, r.created_at
         from readings r
         where r.point_id = p.point_id
         order by r.measured_at desc, r.id desc
         limit 1
       ) l on true
       order by p.point_id`,
      [config.onlineWindowMinutes],
    );

    res.json({
      data: rows.map(serializePoint),
      meta: { online_window_minutes: config.onlineWindowMinutes },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
