import { json } from '../_lib/http.js';

export async function onRequest({ env }) {
  try {
    await env.DB.prepare('SELECT 1').run();
    return json({ ok: true });
  } catch (e) {
    return json({ ok: false, error: '数据库不可用' }, 503);
  }
}
