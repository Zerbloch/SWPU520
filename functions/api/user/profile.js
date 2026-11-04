import { json, run } from '../../_lib/http.js';
import { guard } from '../../_lib/auth.js';
import { safeStr } from '../../_lib/validate.js';

export async function onRequest({ request, env }) {
  const { user, response } = await guard(request, env);
  if (response) return response;

  const body = await request.json().catch(() => ({}));
  const nickname = safeStr(body.nickname, 20);
  if (!nickname) return json({ error: '昵称不能为空' }, 400);

  await run(env, 'UPDATE users SET nickname = ? WHERE id = ?', nickname, user.id);
  return json({ user: Object.assign({}, user, { nickname }) });
}
