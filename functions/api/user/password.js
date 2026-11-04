import { json, first, run } from '../../_lib/http.js';
import { guard } from '../../_lib/auth.js';
import { makeSalt, hashPassword, verifyPassword } from '../../_lib/crypto.js';

export async function onRequest({ request, env }) {
  const { user, response } = await guard(request, env);
  if (response) return response;

  const body = await request.json().catch(() => ({}));
  const oldPassword = String(body.oldPassword || '');
  const newPassword = String(body.newPassword || '');

  if (newPassword.length < 6 || newPassword.length > 64) return json({ error: '新密码长度需为 6-64 位' }, 400);

  const row = await first(env, 'SELECT salt, pass_hash FROM users WHERE id = ?', user.id);
  if (!row || !(await verifyPassword(oldPassword, row.salt, row.pass_hash))) {
    return json({ error: '当前密码不正确' }, 403);
  }

  const salt = makeSalt();
  await run(env, 'UPDATE users SET salt = ?, pass_hash = ? WHERE id = ?', salt, await hashPassword(newPassword, salt), user.id);
  return json({ ok: true });
}
