# D1 + R2 部署手册（照着做，约 15 分钟）

> 适用：`cloudflare/` 这个 Cloudflare Pages 项目（仓库 `Zerbloch/ZIOZ432`）。
> 目标：让 `/api/*` 接口真正跑起来。静态页面不需要 D1/R2 就能打开，但登录、课表、文件全都依赖这两个资源。

---

## 0. 先理解两个资源的角色

| 资源 | 存什么 | 代码里的名字（绑定名） | 建在哪 |
|---|---|---|---|
| **D1** | 用户、课表、文件元数据、AI 缓存（结构化数据） | `DB` | Storage & Databases → D1 |
| **R2** | 上传的文件本体（二进制） | `FILES` | R2 Object Storage |

绑定名是**代码里写死的**，必须一模一样：

```js
env.DB.prepare('SELECT ...')   // 15 处
env.FILES.put(key, buf, ...)   // 8 处
```

写成 `db`、`DATABASE`、`MY_BUCKET` 都会导致 `env.DB is undefined` → 接口 500。

---

## 1. 创建 D1 数据库

**路径**（二选一，看你的侧边栏长什么样）：

- 新版：左侧 **Storage & Databases** → **D1 SQL Database** → **Create database**
- 旧版：**Workers & Pages** → 顶部 **D1** 标签 → **Create database**

**填写**：

| 字段 | 值 |
|---|---|
| Database name | `campus-desk-db` |
| Location / 区域 | 默认即可（想给国内用户更低延迟可选 APAC） |

点 **Create**。

**创建后做一件事**：进入 `campus-desk-db` 详情页，页面顶部有 **Database ID**（一串形如 `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` 的 UUID），点复制存到记事本。

> 只有"方式 B（把绑定写进 wrangler.toml）"才需要这个 UUID。走控制台绑定（方式 A）可以不用。
> 常见错误：把**数据库名称**填进 `database_id` → 报 `Error 8000022: Invalid database UUID`。

---

## 2. 建表（最容易漏的一步）

进入 `campus-desk-db` → 顶部 **Console** 标签 → 把下面**整段** SQL 粘贴进输入框 → 点 **Execute**。

```sql
CREATE TABLE IF NOT EXISTS users (
  id         TEXT PRIMARY KEY,
  username   TEXT NOT NULL UNIQUE COLLATE NOCASE,
  nickname   TEXT NOT NULL,
  salt       TEXT NOT NULL,
  pass_hash  TEXT NOT NULL,
  role       TEXT NOT NULL DEFAULT 'user',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS prefs (
  user_id      TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  days         INTEGER NOT NULL DEFAULT 7,
  periods      INTEGER NOT NULL DEFAULT 12,
  period_times TEXT NOT NULL DEFAULT '',
  term_start   TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS courses (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day        INTEGER NOT NULL,
  start      INTEGER NOT NULL,
  span       INTEGER NOT NULL DEFAULT 1,
  name       TEXT NOT NULL,
  room       TEXT NOT NULL DEFAULT '',
  teacher    TEXT NOT NULL DEFAULT '',
  note       TEXT NOT NULL DEFAULT '',
  color      TEXT NOT NULL DEFAULT '#5566f2',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_courses_user ON courses(user_id);

CREATE TABLE IF NOT EXISTS files (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  size        INTEGER NOT NULL,
  mime        TEXT NOT NULL DEFAULT '',
  stored_name TEXT NOT NULL,
  visibility  TEXT NOT NULL DEFAULT 'public',
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_files_user ON files(user_id);

CREATE TABLE IF NOT EXISTS ai_digests (
  user_id    TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  content    TEXT NOT NULL,
  hash       TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
```

> 这段 SQL 与仓库里的 `schema.sql` 完全相同，且全部是 `IF NOT EXISTS`——**重复执行是安全的**，不会报错也不会清数据。

**验证**：在同一个 Console 里执行

```sql
SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name;
```

必须看到 5 张表：

```
ai_digests
courses
files
prefs
users
```

少一张就说明 SQL 没粘全。全选重粘一次即可（幂等，无副作用）。

---

## 3. 创建 R2 桶

**路径**：左侧 **R2 Object Storage** → **Create bucket**（旧版是 **R2** → Create bucket）

| 字段 | 值 |
|---|---|
| Bucket name | `campus-desk-files` |
| Location | `APAC`（亚太）或 `Automatic` |

**保持默认，不要开 Public access / 自定义域名**。原因：文件是经过 Functions 鉴权后才输出的，私人文件必须只有本人能拿。开了公开访问等于把私人文件暴露给全网。

点 **Create bucket**。创建后桶里是**空的**，这是正常的——文件由应用上传时写入，不是手动传。

> 若提示需要先"启用 R2"或添加支付方式：这是开通对象存储的账号验证。免费额度为 10GB 存储 + 每月 100 万次写 / 1000 万次读，**出网流量免费**，个人使用不会产生费用。

---

## 4. 绑定到 Pages 项目（决定接口能否跑）

**路径**：**Workers & Pages** → 点你的 Pages 项目 → **Settings** → **Bindings**
（旧版 UI 是 **Settings** → **Functions** → **Bindings**，功能一样）

依次添加两条：

### 4.1 D1

点 **Add** → 选 **D1 database**

| 字段 | 值 |
|---|---|
| Variable name | `DB` |
| D1 database | `campus-desk-db` |

点 **Save**。

### 4.2 R2

再点 **Add** → 选 **R2 bucket**

| 字段 | 值 |
|---|---|
| Variable name | `FILES` |
| R2 bucket | `campus-desk-files` |

点 **Save**。

> **环境区分**：Production 和 Preview 是两套独立绑定。
> 至少给 **Production** 配好；Preview 如果也想用，建议指向另一个 D1（否则你在预览环境的测试会写进生产库）。
>
> **不要两边都配**：绑定要么写在 `wrangler.toml`，要么在控制台配。当前 `wrangler.toml` 里的 D1/R2 两块是注释状态，所以你走控制台路线是正确的，别再去取消注释。

---

## 5. 设置密钥 `APP_SECRET`（必做）

代码里是 `env.APP_SECRET || 'dev-secret-change-me'`——不配就会用这个公开的默认值签 Cookie，等于谁都能伪造登录态。

**路径**：Pages 项目 → **Settings** → **Variables and Secrets** → **Add**

| 字段 | 值 |
|---|---|
| Type | **Secret**（不要选 Text/Var） |
| Variable name | `APP_SECRET` |
| Value | 一串随机长字符串（下方命令生成） |

生成随机密钥（任选一条执行）：

```bash
# 有 Node
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 有 openssl
openssl rand -hex 32
```

保存到 **Production** 环境。

**AI 摘要（可选，不做也能正常用）**：再添加一个 Secret `AI_API_KEY`（OpenAI 兼容接口的密钥）。`AI_BASE_URL` / `AI_MODEL` 已经在 `wrangler.toml` 的 `[vars]` 里，不用重复配。没配 `AI_API_KEY` 时，首页 AI 卡片会自动隐藏，不影响其他功能。

---

## 6. 重新部署（不做这步，绑定不生效）

**路径**：Pages 项目 → **Deployments** → 最新那条右侧 **⋯** → **Retry deployment**

等 1~2 分钟到 **Success**。

> 绑定和密钥都属于"运行时配置"，必须重新部署才会注入到 Functions。

---

## 7. 验收（4 项，逐项确认）

### ① 接口活着 + DB 通

浏览器打开：

```
https://<你的域名>.pages.dev/api/health
```

期望：`{"ok":true}`

- 返回 `{"ok":false,"error":"数据库不可用"}` (503) → DB 绑定没生效（变量名错了，或没重新部署）
- 返回 404 → `functions/` 目录位置不对（必须在项目根目录）
- 返回 500 且页面是 HTML → Workers 抛异常，去看 `Deployments → 最新 → Logs`

### ② 种子账户自动创建

首访 `/api/health` 或任意 `/api/*` 会触发 `functions/api/_middleware.js` 的 `ensureSeedAccounts()`，自动写入 6 个账户。

回 D1 Console 执行：

```sql
SELECT username, role, created_at FROM users ORDER BY username;
```

期望 6 行：

| username | role |
|---|---|
| User_101 | user |
| User_102 | user |
| User_103 | user |
| User_104 | user |
| User_105 | user |
| User_106 | **admin** |

这一步同时证明了三件事：D1 绑定成功、表结构正确、种子逻辑跑通。

### ③ 登录能用

打开站点首页 → 用 `User_101` / `SWPU520` 登录 → 应进入工作台并带 7 门示例课。

### ④ R2 通

在文件页上传一个文件 → 回 **R2 → campus-desk-files → Objects**，对象数应从 0 变 1。

对象名是 UUID 形式（如 `a1b2c3d4-....pdf`），不是原文件名——这是设计如此：落盘名与原名解耦，防止路径穿越，原文件名存在 D1 的 `files.name` 里。

---

## 8. 命令行版本（可选，等价于上面全部步骤）

适合想一次性脚本化、或本地没有控制台耐心点的情况。

```bash
cd cloudflare
npx wrangler login                              # 浏览器授权

# 1. 建库（输出里会打印 database_id）
npx wrangler d1 create campus-desk-db

# 2. 建桶
npx wrangler r2 bucket create campus-desk-files

# 3. 建表（--remote 才是线上库，漏了就是在本地虚拟库里建）
npx wrangler d1 execute campus-desk-db --remote --file=./schema.sql

# 4. 密钥
npx wrangler pages secret put APP_SECRET --project-name=campus-desk

# 5. 部署
npx wrangler pages deploy public --project-name=campus-desk
```

**CLI 建库后有个选择**：

- 想让配置可复现 → 把输出的 `database_id` 填进 `wrangler.toml` 的 `[[d1_databases]]` 并取消注释，`git push`；
- 想简单 → 忽略它，去控制台按第 4 节绑定（推荐，少改文件）。

---

## 9. 报错对照表

| 报错 / 现象 | 真实原因 | 解决 |
|---|---|---|
| `Error 8000022: Invalid database UUID` | `wrangler.toml` 里 `database_id` 是占位符或填成了库名 | 删掉/注释掉该绑定，改控制台绑定；或填真实 UUID |
| `env.DB is undefined` / 接口 500 | 绑定名不是 `DB` | Settings → Bindings 改名为 `DB`（大小写敏感） |
| `no such table: users` | 没跑建表 SQL，或跑到了别的库 | 确认在 `campus-desk-db` 的 Console 里执行了第 2 节 SQL |
| `/api/health` 返回 503 | DB 绑定缺失，或绑定后没重新部署 | 补绑定 → Retry deployment |
| `/api/*` 全 404 | `functions/` 不在仓库根目录 | 确认仓库顶层是 `functions/`，不是 `cloudflare/functions/` 之外的层级 |
| 上传报错 `env.FILES is undefined` | R2 绑定名不是 `FILES` | 改名 `FILES` → 重新部署 |
| 上传后 R2 里没有对象 | 绑定指向了另一个桶 | 核对 `FILES` 指向 `campus-desk-files` |
| 登录成功但刷新就掉线 | `APP_SECRET` 没配或每次部署变动 | 配成 Secret 固定值，重新部署 |
| 中文文件名乱码 | 这是浏览器/下载头问题，非 D1 | 本项目已用 `filename*=UTF-8`，若仍乱码请贴日志 |
| 页面 404 但部署成功 | 输出目录不是 `public` | `wrangler.toml` 的 `pages_build_output_dir` 必须是 `public` |

---

## 10. 日常运维速查

```sql
-- 看所有用户
SELECT username, role, datetime(created_at/1000, 'unixepoch', 'localtime') AS 注册时间 FROM users;

-- 看某人的课表
SELECT day, start, span, name, room FROM courses
WHERE user_id = (SELECT id FROM users WHERE username = 'User_101')
ORDER BY day, start;

-- 看某人的文件
SELECT name, size, visibility FROM files
WHERE user_id = (SELECT id FROM users WHERE username = 'User_101');

-- 存储占用
SELECT COUNT(*) AS 文件数, SUM(size)/1024/1024 AS MB FROM files;

-- 全部公开文件（公开库内容）
SELECT u.username, f.name, f.size FROM files f JOIN users u ON u.id = f.user_id
WHERE f.visibility = 'public' ORDER BY f.created_at DESC;
```

**注意（重要）**：D1 的外键级联**不保证生效**，直接 `DELETE FROM users WHERE ...` 会留下孤儿数据（courses / prefs / files / ai_digests 的行还在，R2 里的对象也不会删）。

要干净地删账号，用应用内的「删除账号」功能——`functions/api/user/index.js` 是手动逐表删除 + 逐个删 R2 对象的。

**备份**：

```bash
# 数据库导出（全量 SQL）
npx wrangler d1 export campus-desk-db --remote --output=backup-$(date +%F).sql
```

R2 没有"整桶导出"命令，重要文件建议本地留一份原件。

---

## 11. 一句话流程图

```
建 D1 (campus-desk-db)
   └─ Console 跑 schema.sql  → 5 张表
建 R2 (campus-desk-files)   → 空桶
   └─ Pages → Settings → Bindings
        ├─ DB    → campus-desk-db
        └─ FILES → campus-desk-files
   └─ Secret: APP_SECRET
   └─ Deployments → Retry deployment
   └─ /api/health = {"ok":true}  →  users 表 6 行  →  登录  →  传文件 R2 +1
```
