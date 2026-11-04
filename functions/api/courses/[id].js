import { json, all, first, run, now } from '../../_lib/http.js';
import { guard } from '../../_lib/auth.js';
import { normalizeCourse } from '../../_lib/validate.js';

async function findConflict(env, userId, course, excludeId) {
  const rows = await all(env, 'SELECT id, name, start, span FROM courses WHERE user_id = ? AND day = ?', userId, course.day);
  const s1 = course.start, e1 = course.start + course.span;
  return rows.find((r) => {
    if (excludeId && r.id === excludeId) return false;
    const s2 = r.start, e2 = r.start + r.span;
    return s1 < e2 && s2 < e1;
  }) || null;
}

export async function onRequest({ request, env, params }) {
  const { user, response } = await guard(request, env);
  if (response) return response;
  const id = params.id;
  const method = request.method;

  // 更新
  if (method === 'PUT') {
    const exists = await first(env, 'SELECT id FROM courses WHERE id = ? AND user_id = ?', id, user.id);
    if (!exists) return json({ error: '课程不存在' }, 404);

    const body = await request.json().catch(() => ({}));
    const course = normalizeCourse(body);
    if (!course) return json({ error: '课程名称不能为空' }, 400);

    const conflict = await findConflict(env, user.id, course, id);
    if (conflict) return json({ error: `与「${conflict.name}」时间冲突` }, 409);

    await run(
      env,
      `UPDATE courses SET day = ?, start = ?, span = ?, name = ?, room = ?, teacher = ?, note = ?, color = ?, updated_at = ?
       WHERE id = ? AND user_id = ?`,
      course.day, course.start, course.span, course.name, course.room, course.teacher, course.note, course.color, now(), id, user.id
    );
    return json(Object.assign({ id }, course));
  }

  // 删除
  if (method === 'DELETE') {
    const info = await run(env, 'DELETE FROM courses WHERE id = ? AND user_id = ?', id, user.id);
    if (!info || !info.meta || info.meta.changes === 0) return json({ error: '课程不存在' }, 404);
    return json({ ok: true });
  }

  return json({ error: '方法不支持' }, 405);
}
