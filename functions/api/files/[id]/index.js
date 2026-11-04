import { json, first, run } from '../../../_lib/http.js';
import { guard } from '../../../_lib/auth.js';

/** 删除文件（含 R2 对象） */
export async function onRequest({ request, env, params }) {
  const { user, response } = await guard(request, env);
  if (response) return response;

  const row = await first(env, 'SELECT stored_name FROM files WHERE id = ? AND user_id = ?', params.id, user.id);
  if (!row) return json({ error: '文件不存在' }, 404);

  await run(env, 'DELETE FROM files WHERE id = ? AND user_id = ?', params.id, user.id);
  try { await env.FILES.delete(row.stored_name); } catch (e) { /* 忽略 */ }

  return json({ ok: true });
}
