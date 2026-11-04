import { json, run } from '../../../_lib/http.js';
import { guard } from '../../../_lib/auth.js';
import { safeStr } from '../../../_lib/validate.js';

export async function onRequest({ request, env, params }) {
  const { user, response } = await guard(request, env);
  if (response) return response;

  const body = await request.json().catch(() => ({}));
  const name = safeStr(body.name, 200);
  if (!name) return json({ error: '文件名不能为空' }, 400);

  const info = await run(env, 'UPDATE files SET name = ? WHERE id = ? AND user_id = ?', name, params.id, user.id);
  if (!info || !info.meta || info.meta.changes === 0) return json({ error: '文件不存在' }, 404);

  return json({ ok: true, name });
}
