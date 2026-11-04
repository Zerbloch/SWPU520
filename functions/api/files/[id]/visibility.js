import { json, run } from '../../../_lib/http.js';
import { guard } from '../../../_lib/auth.js';

export async function onRequest({ request, env, params }) {
  const { user, response } = await guard(request, env);
  if (response) return response;

  const body = await request.json().catch(() => ({}));
  const v = String(body.visibility || '').toLowerCase();
  if (v !== 'public' && v !== 'private') return json({ error: '可见性只能是 public 或 private' }, 400);

  const info = await run(env, 'UPDATE files SET visibility = ? WHERE id = ? AND user_id = ?', v, params.id, user.id);
  if (!info || !info.meta || info.meta.changes === 0) return json({ error: '文件不存在' }, 404);

  return json({ ok: true, visibility: v });
}
