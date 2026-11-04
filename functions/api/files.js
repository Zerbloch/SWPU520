import { json, all, run, uid, now } from '../_lib/http.js';
import { guard } from '../_lib/auth.js';
import { safeStr } from '../_lib/validate.js';
import { kindOf } from '../_lib/preview.js';
import { FILE_COLS, withKind } from '../_lib/files.js';

const MAX_FILE_SIZE = 100 * 1024 * 1024;

export async function onRequest({ request, env }) {
  const { user, response } = await guard(request, env);
  if (response) return response;
  const method = request.method;

  // 我的文件列表
  if (method === 'GET') {
    const rows = await all(env, `SELECT ${FILE_COLS} FROM files WHERE user_id = ? ORDER BY created_at DESC`, user.id);
    return json({ files: withKind(rows), officeReady: false });
  }

  // 上传
  if (method === 'POST') {
    const form = await request.formData().catch(() => null);
    const file = form && form.get('file');
    if (!file || typeof file.arrayBuffer !== 'function') return json({ error: '没有收到文件' }, 400);
    if (file.size > MAX_FILE_SIZE) return json({ error: '文件超过 100MB 上限' }, 413);

    const id = uid();
    const size = file.size;

    // 文件名：优先用前端自定义名，否则用原始名
    let name = safeStr(String(form.get('name') || ''), 200);
    if (!name) name = safeStr(String(file.name || ''), 200) || '未命名文件';

    const visibility = String(form.get('visibility') || '').toLowerCase() === 'private' ? 'private' : 'public';

    // 落盘 key：与原文件名解耦，杜绝路径穿越
    const ext = String(file.name || '').split('.').pop().slice(0, 12).replace(/[^\w.]/g, '');
    const storedName = id + (ext ? '.' + ext : '');

    const buf = await file.arrayBuffer();
    await env.FILES.put(storedName, buf, {
      httpMetadata: { contentType: file.type || 'application/octet-stream' }
    });

    await run(
      env,
      'INSERT INTO files (id, user_id, name, size, mime, stored_name, visibility, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      id, user.id, name, size, file.type || '', storedName, visibility, now()
    );

    return json({ id, name, size, mime: file.type || '', visibility, createdAt: now(), kind: kindOf(name) }, 201);
  }

  return json({ error: '方法不支持' }, 405);
}
