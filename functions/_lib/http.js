/**
 * 响应工具 + D1 封装
 */

/* ---------------- 响应 ---------------- */

export function json(data, status = 200, extraHeaders) {
  const headers = new Headers({ 'Content-Type': 'application/json; charset=utf-8' });
  if (extraHeaders) extraHeaders.forEach((v, k) => headers.append(k, v));
  return new Response(JSON.stringify(data), { status, headers });
}

export const error = (msg, status = 400) => json({ error: msg }, status);

/* ---------------- D1 查询封装 ---------------- */

export const all = (env, sql, ...params) =>
  env.DB.prepare(sql).bind(...params).all().then((r) => r.results || []);

export const first = (env, sql, ...params) =>
  env.DB.prepare(sql).bind(...params).first();

export const run = (env, sql, ...params) =>
  env.DB.prepare(sql).bind(...params).run();

export const batch = (env, statements) => env.DB.batch(statements);

/* ---------------- 工具 ---------------- */

export const uid = () => crypto.randomUUID();
export const now = () => Date.now();
