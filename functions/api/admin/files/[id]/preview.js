import { json } from '../../../../_lib/http.js';
import { guard, guardAdmin } from '../../../../_lib/auth.js';
import { loadFileAnyUser } from '../../../../_lib/files.js';
import { kindOf } from '../../../../_lib/preview.js';

export async function onRequest({ request, env, params }) {
  const { user, response } = await guard(request, env);
  if (response) return response;
  const adminErr = guardAdmin(user);
  if (adminErr) return adminErr;

  const row = await loadFileAnyUser(env, params.id);
  if (!row) return json({ error: '文件不存在' }, 404);

  const obj = await env.FILES.get(row.stored_name);
  if (!obj) return json({ error: '文件已被清理' }, 410);

  const kind = kindOf(row.name);

  if (kind === 'image' || kind === 'pdf') {
    return new Response(obj.body, {
      headers: { 'Content-Type': row.mime || 'application/octet-stream', 'Content-Disposition': 'inline', 'Cache-Control': 'private, max-age=300' }
    });
  }
  if (kind === 'text') {
    const text = await obj.text();
    return new Response(text, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'private, max-age=300' } });
  }
  if (kind === 'office') {
    return json({ error: 'Cloudflare 环境无文档转换组件，Word / Excel / PPT 暂不支持在线预览，请下载后查看' }, 501);
  }
  return json({ error: '该文件类型暂不支持在线预览，请下载后查看' }, 415);
}
