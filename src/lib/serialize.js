import { config } from '../config.js';
import { formatInOffset } from './time.js';

export function serializeReading(row) {
  return {
    id: Number(row.id),
    point_id: row.point_id,
    location: row.location,
    time: formatInOffset(row.measured_at, config.tzOffsetMinutes),
    db: Number(row.db),
    period: row.period,
    created_at: row.created_at
      ? formatInOffset(row.created_at, config.tzOffsetMinutes)
      : null,
  };
}

export function serializePoint(row) {
  return {
    point_id: row.point_id,
    location: row.location,
    created_at: formatInOffset(row.created_at, config.tzOffsetMinutes),
    updated_at: formatInOffset(row.updated_at, config.tzOffsetMinutes),
    online: Boolean(row.online),
    last_reading: row.last_time
      ? {
          time: formatInOffset(row.last_time, config.tzOffsetMinutes),
          db: Number(row.last_db),
          period: row.last_period,
        }
      : null,
  };
}

export function serializeFilters(filters) {
  return {
    point_id: filters.pointId,
    period: filters.period,
    from: filters.from ? formatInOffset(filters.from, config.tzOffsetMinutes) : null,
    to: filters.to ? formatInOffset(filters.to, config.tzOffsetMinutes) : null,
  };
}
