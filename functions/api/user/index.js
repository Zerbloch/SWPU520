import { json, all, run } from '../../_lib/http.js';
import { guard, clearAuthCookie } from '../../_lib/auth.js';

/** 注销账号：手动级联删除数据 + R2 文件（D1 外键不保证生效） */
export async function onRequest({ request, env }) {
  const { user, response } = await guard(request, env);
  if (response) return response;

  const files = await all(env, 'SELECT stored_name FROM files WHERE user_id = ?', user.id);
  for (const f of files) {
    try { await env.FILES.delete(f.stored_name); } catch (e) { /* 忽略 */ }
  }

  await env.DB.batch([
    env.DB.prepare('DELETE FROM courses WHERE user_id = ?').bind(user.id),
    env.DB.prepare('DELETE FROM prefs WHERE user_id = ?').bind(user.id),
    env.DB.prepare('DELETE FROM files WHERE user_id = ?').bind(user.id),
    env.DB.prepare('DELETE FROM ai_digests WHERE user_id = ?').bind(user.id),
    env.DB.prepare('DELETE FROM users WHERE id = ?').bind(user.id)
  ]);

  const headers = new Headers();
  clearAuthCookie(headers);
  return json({ ok: true, filesRemoved: files.length }, 200, headers);
}
