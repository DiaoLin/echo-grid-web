-- EchoGrid 初始表结构

-- 测点档案：每个 point_id 一行，位置以最近一次上报为准
create table if not exists points (
  point_id   text primary key,
  location   text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 噪声读数：只保存分贝、时间、测点编号等非隐私数据，不保存音频
create table if not exists readings (
  id          bigserial primary key,
  point_id    text not null references points (point_id) on update cascade on delete cascade,
  location    text not null,
  measured_at timestamptz not null,
  db          real not null check (db >= 0 and db <= 200),
  period      text not null check (period in ('课间', '午休', '放学')),
  created_at  timestamptz not null default now()
);

create index if not exists readings_point_time_idx
  on readings (point_id, measured_at desc);

create index if not exists readings_time_idx
  on readings (measured_at desc);

create index if not exists readings_period_time_idx
  on readings (period, measured_at desc);
