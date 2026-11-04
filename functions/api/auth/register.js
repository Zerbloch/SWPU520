import { json, first, run, uid, now } from '../../_lib/http.js';
import { makeSalt, hashPassword } from '../../_lib/crypto.js';
import { setAuthCookie } from '../../_lib/auth.js';
import { safeStr, USERNAME_RE } from '../../_lib/validate.js';

/** 注册：默认关闭（封闭系统）。设 ALLOW_REGISTER=1 可临时重开。 */
export async function onRequest({ request, env }) {
  if (env.ALLOW_REGISTER !== '1') {
    return json({ error: '注册已关闭，请联系管理员分配账户' }, 403);
  }

  const body = await request.json().catch(() => ({}));
  const username = safeStr(body.username, 20);
  const nickname = safeStr(body.nickname, 20) || username;
  const password = String(body.password || '');

  if (!USERNAME_RE.test(username)) return json({ error: '用户名需为 3-20 位字母、数字或下划线' }, 400);
  if (password.length < 6 || password.length > 64) return json({ error: '密码长度需为 6-64 位' }, 400);

  const exists = await first(env, 'SELECT id FROM users WHERE username = ?', username);
  if (exists) return json({ error: '该用户名已被注册' }, 409);

  const salt = makeSalt();
  const passHash = await hashPassword(password, salt);
  const id = uid();
  await run(
    env,
    'INSERT INTO users (id, username, nickname, salt, pass_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    id, username, nickname, salt, passHash, 'user', now()
  );
  await run(env, 'INSERT INTO prefs (user_id, days, periods) VALUES (?, 7, 12)', id);

  const headers = new Headers();
  await setAuthCookie(headers, id, env, true);
  return json({ user: { id, username, nickname, role: 'user', createdAt: now() } }, 201, headers);
}
