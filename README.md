# EchoGrid Web 后端

EchoGrid 校园噪声地图的 Node.js + PostgreSQL 后端。接口字段与主仓库 `README.md` 的「数据格式」一致，前端静态文件统一放在 `public/`（主仓库中为 `web/public`）。

## 目录结构

```
web/
├── src/
│   ├── index.js             # npm 包入口，导出 createApp / config / db
│   ├── server.js            # 命令行启动入口（bin）
│   ├── app.js               # Express 应用、静态托管
│   ├── config.js            # 环境变量
│   ├── db.js                # PostgreSQL 连接池 / 事务
│   ├── routes/              # API 路由
│   ├── middleware/          # 鉴权、日志、错误处理
│   └── lib/                 # 校验、时间、CSV、序列化
├── migrations/              # PostgreSQL 迁移 SQL
├── scripts/migrate.js       # 迁移执行器（bin）
├── public/                  # 前端静态文件（暂时为空）
├── test/                    # node:test 单元测试
├── package.json
└── .env.example
```

## 技术栈

- Node.js 20+，标准 ESM npm 包（`main` / `exports` / `bin`）
- Express 5
- PostgreSQL 14+
- `pg` 连接池，无 ORM，SQL 直接可读
- `node:test` 单元测试

## 快速开始

以下命令在本仓库根目录执行；如果作为主仓库的 `web/` 子树使用，先进入 `web/` 目录。

### 1. 准备外部 PostgreSQL

本项目不自带数据库，也不提供默认连接配置。请准备一个可访问的 PostgreSQL 14+ 数据库，并确保迁移账号有建表权限。

### 2. 配置环境变量

```bash
cp .env.example .env
```

Windows PowerShell 可用：

```powershell
Copy-Item .env.example .env
```

在 `.env` 中显式填写外部数据库连接，例如：

```text
DATABASE_URL=postgres://<user>:<password>@<host>:5432/<database>
```

也可以改用标准 `PGHOST` / `PGPORT` / `PGDATABASE` / `PGUSER` / `PGPASSWORD`。未配置时服务会拒绝启动。

### 3. 安装依赖并迁移

```bash
npm install
npm run db:migrate
```

### 4. 启动

```bash
npm run dev     # 开发模式，文件变更自动重启
npm start       # 生产模式
```

启动后：

- 服务：http://localhost:3000
- API 说明：http://localhost:3000/api
- 健康检查：http://localhost:3000/api/health

> `web/public` 暂时为空，访问 `/` 会返回后端说明。放入 `index.html` 后，后端会自动托管前端页面。

## 作为 npm 包使用

`package.json` 已按标准 Node 包组织：

- `main` / `exports`：入口为 `src/index.js`，可导入 `createApp`、`config`、`pool` 等
- `bin`：提供 `echo-grid-server` 和 `echo-grid-migrate` 两个命令
- `files`：发布时包含 `src`、`migrations`、`scripts`、`public`、`.env.example`

在本机全局安装：

```bash
npm install -g .
echo-grid-migrate
echo-grid-server
```

全局运行时可把 `.env` 放在当前工作目录，或直接设置 `DATABASE_URL` 环境变量。

作为依赖嵌入其他 Node 项目：

```js
import { createApp } from 'echo-grid-web';

const app = createApp();
app.listen(3000);
```

检查发布内容：

```bash
npm pack --dry-run
```

当前 `private: true`，只用于本地或私有安装；如需发布到 npm，将其改为 `false` 并补充合适的 `license`。

## 环境变量

| 变量 | 默认值 | 说明 |
|---|---|---|
| `PORT` | `3000` | 服务监听端口，直接读取 `process.env.PORT` |
| `DATABASE_URL` | 无（必须配置） | 外部 PostgreSQL 连接串；也可使用标准 `PGHOST` / `PGPORT` / `PGDATABASE` / `PGUSER` / `PGPASSWORD` |
| `PGSSL` | `false` | 是否启用数据库 SSL |
| `INGEST_TOKEN` | 空 | 设置后，写接口需要 `Authorization: Bearer <token>` 或 `X-API-Key: <token>` |
| `CORS_ORIGIN` | `*` | 允许跨域的来源，多个用逗号分隔 |
| `APP_TZ_OFFSET` | `+08:00` | 上报时间未带时区时按此偏移解释 |
| `ONLINE_WINDOW_MINUTES` | `5` | 超过多少分钟无新数据视为离线 |
| `DEFAULT_LIMIT` | `200` | 历史查询默认条数 |
| `MAX_LIMIT` | `5000` | 历史查询最大条数 |
| `MAX_EXPORT_ROWS` | `100000` | CSV 单次最大导出行数 |

## API

所有响应均为 JSON（CSV 导出除外）。时间统一返回带时区的 ISO 8601 字符串，例如 `2026-12-05T10:30:00+08:00`。

### 上报单条读数

```http
POST /api/readings
Content-Type: application/json
```

```json
{
  "point_id": "P01",
  "location": "教学楼A走廊",
  "time": "2026-12-05 10:30:00",
  "db": 62.3,
  "period": "课间"
}
```

- `point_id`：必填，1—32 位字母、数字、下划线或短横线
- `location`：必填，最长 128 字符
- `time`：可选，默认当前时间；支持 `YYYY-MM-DD HH:mm:ss`、ISO 8601、`YYYY-MM-DD`
- `db`：必填，0—200，保留 1 位小数
- `period`：可选，只能是 `课间` / `午休` / `放学`；省略时按时间推断

成功返回 `201`：

```json
{
  "data": {
    "id": 1,
    "point_id": "P01",
    "location": "教学楼A走廊",
    "time": "2026-12-05T10:30:00+08:00",
    "db": 62.3,
    "period": "课间",
    "created_at": "2026-12-05T10:30:02+08:00"
  }
}
```

### 批量上报

```http
POST /api/readings/batch
```

请求体为数组，或 `{ "readings": [ ... ] }`，单次最多 1000 条。用于 ESP32 断网恢复后补传。

### 查询历史读数

```http
GET /api/readings?point_id=P01&period=课间&from=2026-12-05%2008:00:00&to=2026-12-05%2012:00:00&limit=200&offset=0
```

| 参数 | 说明 |
|---|---|
| `point_id` | 可选，测点编号 |
| `period` | 可选，`课间` / `午休` / `放学` |
| `from` / `to` | 可选，时间范围（含端点） |
| `limit` | 可选，默认 200，最大 5000 |
| `offset` | 可选，默认 0 |

返回按时间升序排列，适合直接喂给 Chart.js。

### 每个测点的最新读数

```http
GET /api/readings/latest
```

### 测点列表与在线状态

```http
GET /api/points
```

返回每个测点的最近位置、最新读数，以及是否在 `ONLINE_WINDOW_MINUTES` 内上报过。

### 汇总统计

```http
GET /api/stats?from=2026-12-05%2008:00:00&to=2026-12-05%2018:00:00
```

支持与历史查询相同的 `point_id` / `period` / `from` / `to` 过滤，返回：

- `overall`：总体平均值、最小值、最大值、条数
- `points`：按测点汇总，并附 `by_period` 分时段数据
- `periods`：按课间 / 午休 / 放学汇总，便于做分时段对比

### 导出 CSV

```http
GET /api/export.csv?point_id=P01&from=2026-12-05%2008:00:00
```

表头与 README 一致：

```csv
point_id,location,time,db,period
```

文件带 UTF-8 BOM，Excel 打开中文不乱码。

### 健康检查

```http
GET /api/health
```

### 错误格式

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "db 必须在 0—200 之间"
  }
}
```

## ESP32 上报示例

ESP32 只需发送 HTTP POST：

```cpp
HTTPClient http;
http.begin("http://<服务器IP>:3000/api/readings");
http.addHeader("Content-Type", "application/json");
if (INGEST_TOKEN[0]) {
  http.addHeader("X-API-Key", INGEST_TOKEN);
}

String body = String("{\"point_id\":\"P01\",\"location\":\"教学楼A走廊\",\"time\":\"")
  + timeStr + "\",\"db\":" + String(db, 1)
  + ",\"period\":\"" + period + "\"}";

int status = http.POST(body);
```

## 测试

```bash
npm test
```

单元测试覆盖时间解析、时段推断、字段校验、查询参数和 CSV 输出，不需要数据库。

## 与前端 / 子树的约定

`web` 按“可独立成仓库、再由主仓库以 git subtree 引入”的方式组织：

- 后端代码、迁移、测试位于本仓库根目录（主仓库中的 `web/`）
- 前端代码全部放入 `public/`（主仓库中的 `web/public`），不修改后端目录
- `public/` 由 Express 直接托管，未知 GET 路径回退到 `public/index.html`，因此前端可以使用 History 路由

配置好独立仓库地址后，在根仓库使用：

```bash
git subtree add   --prefix=web <web-repo-url> main --squash
git subtree pull  --prefix=web <web-repo-url> main --squash
git subtree push  --prefix=web <web-repo-url> main
```

## 数据与隐私

数据库只保存测点编号、位置描述、采集时间、分贝值和时段，不保存音频，符合 README 中的隐私约定。
