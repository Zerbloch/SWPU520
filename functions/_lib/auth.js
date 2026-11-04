/**
 * 鉴权：Cookie 解析 + 登录态 + 角色
 */

import { signToken, verifyToken } from './crypto.js';
import { first } from './http.js';

const COOKIE_NAME = 'cd_token';
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 天

function parseCookies(request) {
  const header = request.headers.get('Cookie') || '';
  const map = new Map();
  header.split(';').forEach((part) => {
    const i = part.indexOf('=');
    if (i > 0) map.set(part.slice(0, i).trim(), part.slice(i + 1).trim());
  });
  return map;
}

function secretOf(env) {
  return env.APP_SECRET || 'dev-secret-change-me';
}

/** 从请求解析当前用户；未登录返回 null */
export async function getAuthUser(request, env) {
  const token = parseCookies(request).get(COOKIE_NAME);
  const uid = token ? await verifyToken(token, secretOf(env)) : null;
  if (!uid) return null;
  return first(
    env,
    'SELECT id, username, nickname, role, created_at AS createdAt FROM users WHERE id = ?',
    uid
  );
}

/** 下发登录 Cookie（remember=true 时持久化 7 天） */
export async function setAuthCookie(headers, uid, env, remember) {
  const token = await signToken(uid, secretOf(env), TTL_MS);
  let cookie = `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax`;
  if (remember) cookie += `; Max-Age=${Math.floor(TTL_MS / 1000)}`;
  headers.append('Set-Cookie', cookie);
}

/** 清除 Cookie */
export function clearAuthCookie(headers) {
  headers.append('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; Max-Age=0`);
}

/* ---------------- 路由守卫（返回 { user, response }） ---------------- */

export async function guard(request, env) {
  const user = await getAuthUser(request, env);
  if (!user) {
    return { user: null, response: json401() };
  }
  return { user, response: null };
}

export function guardAdmin(user) {
  if (!user || user.role !== 'admin') {
    return json403();
  }
  return null;
}

function json401() {
  return new Response(JSON.stringify({ error: '未登录或登录已过期' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}

function json403() {
  return new Response(JSON.stringify({ error: '需要管理员权限' }), {
    status: 403,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}
