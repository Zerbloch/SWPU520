import { json } from '../../../_lib/http.js';
import { guard } from '../../../_lib/auth.js';
import { loadAccessibleFile } from '../../../_lib/files.js';

export async function onRequest({ request, env, params }) {
  const { user, response } = await guard(request, env);
  if (response) return response;

  const row = await loadAccessibleFile(env, params.id, user);
  if (!row) return json({ error: '文件不存在' }, 404);

  const obj = await env.FILES.get(row.stored_name);
  if (!obj) return json({ error: '文件已被清理' }, 410);

  const headers = new Headers();
  headers.set('Content-Type', row.mime || 'application/octet-stream');
  headers.set('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(row.name)}`);
  headers.set('Content-Length', String(row.size));
  return new Response(obj.body, { headers });
}
