-- ============================================================
-- Campus Desk · Cloudflare D1 数据库 Schema
-- ------------------------------------------------------------
-- 应用方式：
--   npx wrangler d1 execute campus-desk-db --remote --file=./schema.sql
-- 幂等：可重复执行（全部用 IF NOT EXISTS）。
-- ============================================================

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
