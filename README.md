# Campus Desk · Cloudflare 部署版

这是校园工作台（课表 + 文件 + 多用户 + AI 摘要 + 超级管理员）的 **无服务器部署版本**，
可直接部署到 **Cloudflare Pages**，代码托管在 **GitHub** 并由 Cloudflare 直连自动部署。

## 架构

```
浏览器 ── HTTPS ──> Cloudflare Pages
                     ├── public/        静态前端（桌面 + 移动端，同源托管）
                     └── functions/      Pages Functions 后端（/api/*）
                          ├── D1        关系数据（用户/课表/文件元数据/AI 缓存）
                          └── R2        上传文件的二进制内容
```

- **前端与 API 同源**：前端代码零改动，`fetch('/api/...')` 直接命中 `functions/api/`。
- **D1**：Cloudflare 的 SQLite 兼容数据库，替代原自建版的 SQLite。
- **R2**：对象存储，替代原自建版的磁盘文件目录。

## 目录结构

```
cloudflare/
├── wrangler.toml            # Pages + D1 + R2 配置
├── schema.sql               # D1 数据库 schema（幂等）
├── public/                  # 前端（桌面 + 移动端）
├── functions/               # Pages Functions 后端
│   ├── _lib/                # 共享库（密码哈希 / 鉴权 / D1 / AI / 文件）
│   └── api/                 # 全部接口（auth / user / courses / files / ai / admin）
└── .github/workflows/       # GitHub Actions 自动部署
```

## 一、前置要求

- 一个 [Cloudflare](https://dash.cloudflare.com) 账号
- Node.js ≥ 18（本地跑 wrangler CLI 用）

## 二、部署步骤

### 1. 安装 wrangler

```bash
npm install -g wrangler
wrangler login
```

### 2. 创建 D1 数据库

```bash
npx wrangler d1 create campus-desk-db
```

命令会输出一个 `database_id`，把它填进 `wrangler.toml`：

```toml
[[d1_databases]]
binding = "DB"
database_name = "campus-desk-db"
database_id = "把这里替换成你的 database_id"
```

### 3. 创建 R2 存储桶

```bash
npx wrangler r2 bucket create campus-desk-files
```

### 4. 应用数据库 schema

```bash
npx wrangler d1 execute campus-desk-db --remote --file=./schema.sql
```

### 5. 配置密钥

```bash
# 令牌签名密钥（必填，用随机长字符串）
npx wrangler pages secret put APP_SECRET --project-name=campus-desk

# AI 大模型（可选；不配则首页 AI 卡片自动隐藏）
npx wrangler pages secret put AI_API_KEY --project-name=campus-desk
```

> 也可以把 `AI_BASE_URL` / `AI_MODEL` 等非敏感项写在 `wrangler.toml` 的 `[vars]` 里。

### 6. 部署

```bash
npx wrangler pages deploy public --project-name=campus-desk
```

部署完成后，终端会给出访问地址（形如 `https://campus-desk.pages.dev`），打开即可使用。

## 三、连接 GitHub 自动部署

把本目录（`cloudflare/`）作为**独立 Git 仓库**推到 GitHub：

```bash
cd cloudflare
git init
git add .
git commit -m "campus desk cloudflare version"
git branch -M main
git remote add origin https://github.com/<你的账号>/<仓库名>.git
git push -u origin main
```

然后在 Cloudflare 控制台：

1. **Workers & Pages → Create → Pages → Connect to Git**，选择该仓库。
2. 构建配置：Framework preset 选 **None**，Build command 留空，Output directory 填 `public`。
3. 部署后，再到该 Pages 项目的 **Settings → Functions → D1 database bindings / R2 bucket bindings** 里，
   把上面创建的 D1 和 R2 绑定进去（binding 名称分别为 `DB` 和 `FILES`）。
4. 以后每次 `git push` 到 `main`，Cloudflare 会自动重新部署。

> 仓库里已附带 `.github/workflows/deploy.yml`，也可以走 GitHub Actions 自动部署。
> 使用它需要在 GitHub 仓库的 Settings → Secrets 里配置
> `CLOUDFLARE_API_TOKEN` 和 `CLOUDFLARE_ACCOUNT_ID`。

## 四、账户与权限

系统是**封闭系统**（注册已关闭），首次部署后自动预置 6 个账户：

| 账户 | 密码 | 角色 |
|---|---|---|
| User_101 ~ User_105 | SWPU520 | 普通用户 |
| User_106 | 19361003EN | 超级管理员 |

- 超级管理员登录后有「管理」入口，可查看任意用户的课表与文件（含私人文件）。
- 密码用 PBKDF2-SHA256 加盐哈希存储，登录态为 httpOnly Cookie 里的 HMAC 签名令牌。

## 五、与自建版的功能差异（重要）

| 功能 | 自建版（Express + SQLite） | Cloudflare 版 |
|---|---|---|
| 课表 / 多用户 / 公开·私人文件 | ✅ | ✅ |
| 图片 / PDF / 文本在线预览 | ✅ | ✅ |
| **Word / Excel / PPT 在线预览** | ✅（需装 LibreOffice） | ❌ **只能下载**（Cloudflare 无转换组件） |
| AI 摘要（今日安排） | ✅ | ✅（配 AI_API_KEY 后可用） |
| 演示模式（DEMO_MODE） | ✅ | ❌ 不支持 |
| 单文件上限 | 100MB | 受 Workers 请求体限制（免费版建议 ≤ 25MB） |

## 六、本地开发

```bash
cd cloudflare
npx wrangler pages dev public \
  --d1 DB=$(npx wrangler d1 create campus-desk-db --local | tail -1) \
  --r2 FILES
```

> 本地开发需要 `miniflare` 提供 D1/R2 模拟，首次会提示安装。

## 七、数据备份

- **D1 数据**：`npx wrangler d1 export campus-desk-db --remote --output=backup.sql`
- **R2 文件**：`npx wrangler r2 object get ...`（建议用 rclone 等工具同步整个桶）

## 八、常见错误

### `Error 8000022: Invalid database UUID`
`wrangler.toml` 里的 D1 `database_id` 还是占位符，Cloudflare 在发布 Functions 时校验失败。

**解决（二选一）：**

- **推荐**：在 Cloudflare 控制台创建 D1 数据库与 R2 桶，然后到
  **Pages → 你的项目 → Settings → Functions → Bindings** 添加：
  - D1 database → Variable name 填 `DB`
  - R2 bucket → Variable name 填 `FILES`

  保存后会自动重新部署（`wrangler.toml` 里的绑定保持注释即可）。
- 或者把真实的 D1 `Database ID`（UUID）填进 `wrangler.toml` 的 `[[d1_databases]]`，
  取消注释后重新 `git push`。

### 页面能打开但接口报 500
通常是 D1/R2 绑定还没生效。检查上面两个绑定是否存在，且变量名严格为 `DB` 和 `FILES`。
