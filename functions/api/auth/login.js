import { json, first } from '../../_lib/http.js';
import { verifyPassword } from '../../_lib/crypto.js';
import { setAuthCookie } from '../../_lib/auth.js';
import { safeStr } from '../../_lib/validate.js';

export async function onRequest({ request, env }) {
  const body = await request.json().catch(() => ({}));
  const username = safeStr(body.username, 20);
  const password = String(body.password || '');

  if (!username || !password) return json({ error: '请填写用户名和密码' }, 400);
  if (username === '__demo__') return json({ error: '用户名或密码不正确' }, 401);

  const row = await first(env, 'SELECT * FROM users WHERE username = ?', username);
  if (!row || !(await verifyPassword(password, row.salt, row.pass_hash))) {
    return json({ error: '用户名或密码不正确' }, 401);
  }

  const headers = new Headers();
  await setAuthCookie(headers, row.id, env, !!body.remember);
  return json({
    user: { id: row.id, username: row.username, nickname: row.nickname, role: row.role, createdAt: row.created_at }
  }, 200, headers);
}
