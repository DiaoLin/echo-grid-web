import test from 'node:test';
import assert from 'node:assert/strict';

import { ValidationError } from '../src/lib/errors.js';
import {
  formatInOffset,
  inferPeriod,
  parseMeasuredAt,
  parsePeriod,
} from '../src/lib/time.js';
import { parseFilters } from '../src/lib/filters.js';
import { validateBatch, validateReading } from '../src/lib/validate.js';
import { csvEscape, toCsv } from '../src/lib/csv.js';

test('parseMeasuredAt 把无时区时间按 +08:00 解释', () => {
  const date = parseMeasuredAt('2026-12-05 10:30:00');
  assert.equal(date.toISOString(), '2026-12-05T02:30:00.000Z');
});

test('parseMeasuredAt 保留显式时区', () => {
  const date = parseMeasuredAt('2026-12-05T10:30:00Z');
  assert.equal(date.toISOString(), '2026-12-05T10:30:00.000Z');
});

test('parseMeasuredAt 拒绝无效时间', () => {
  assert.throws(() => parseMeasuredAt('不是时间'), ValidationError);
});

test('formatInOffset 输出带偏移的时间', () => {
  const date = new Date('2026-12-05T02:30:00.000Z');
  assert.equal(formatInOffset(date, 480), '2026-12-05T10:30:00+08:00');
});

test('inferPeriod 按北京时间推断时段', () => {
  assert.equal(inferPeriod(new Date('2026-12-05T01:00:00Z')), '课间');
  assert.equal(inferPeriod(new Date('2026-12-05T04:30:00Z')), '午休');
  assert.equal(inferPeriod(new Date('2026-12-05T09:30:00Z')), '放学');
});

test('parsePeriod 只接受三个时段', () => {
  assert.equal(parsePeriod('课间'), '课间');
  assert.throws(() => parsePeriod('深夜'), ValidationError);
});

test('validateReading 规范化字段', () => {
  const reading = validateReading({
    point_id: ' P01 ',
    location: ' 教学楼A走廊 ',
    time: '2026-12-05 10:30:00',
    db: '62.34',
    period: '课间',
  });

  assert.equal(reading.point_id, 'P01');
  assert.equal(reading.location, '教学楼A走廊');
  assert.equal(reading.db, 62.3);
  assert.equal(reading.period, '课间');
  assert.equal(reading.measured_at.toISOString(), '2026-12-05T02:30:00.000Z');
});

test('validateReading 缺少 period 时自动推断', () => {
  const reading = validateReading({
    point_id: 'P01',
    location: '操场',
    time: '2026-12-05 12:30:00',
    db: 55,
  });
  assert.equal(reading.period, '午休');
});

test('validateReading 拒绝越界分贝', () => {
  assert.throws(
    () => validateReading({ point_id: 'P01', location: '操场', db: 250 }),
    ValidationError,
  );
});

test('validateBatch 支持数组和 readings 包装', () => {
  const item = {
    point_id: 'P01',
    location: '操场',
    time: '2026-12-05 10:30:00',
    db: 60,
    period: '课间',
  };

  assert.equal(validateBatch([item]).length, 1);
  assert.equal(validateBatch({ readings: [item] }).length, 1);
  assert.throws(() => validateBatch([]), ValidationError);
});

test('parseFilters 校验并返回过滤条件', () => {
  const filters = parseFilters({
    point_id: 'P01',
    period: '午休',
    from: '2026-12-05 10:00:00',
    to: '2026-12-05 11:00:00',
    limit: '50',
  });

  assert.equal(filters.pointId, 'P01');
  assert.equal(filters.period, '午休');
  assert.equal(filters.limit, 50);
  assert.equal(filters.from.toISOString(), '2026-12-05T02:00:00.000Z');
});

test('parseFilters 拒绝非法 limit 和倒置的时间范围', () => {
  assert.throws(() => parseFilters({ limit: '999999' }), ValidationError);
  assert.throws(
    () => parseFilters({
      from: '2026-12-05 12:00:00',
      to: '2026-12-05 10:00:00',
    }),
    ValidationError,
  );
});

test('csvEscape 处理逗号、引号和换行', () => {
  assert.equal(csvEscape('普通'), '普通');
  assert.equal(csvEscape('教学楼,A'), '"教学楼,A"');
  assert.equal(csvEscape('说"你好"'), '"说""你好"""');
});

test('toCsv 输出 README 约定的表头', () => {
  const csv = toCsv([
    {
      point_id: 'P01',
      location: '教学楼A走廊',
      time: '2026-12-05T10:30:00+08:00',
      db: 62.3,
      period: '课间',
    },
  ]);

  const [header, row] = csv.trimEnd().split('\r\n');
  assert.equal(header, 'point_id,location,time,db,period');
  assert.equal(row, 'P01,教学楼A走廊,2026-12-05T10:30:00+08:00,62.3,课间');
});
