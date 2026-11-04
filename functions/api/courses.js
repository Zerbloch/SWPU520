import { json, all, run, uid, now } from '../_lib/http.js';
import { guard } from '../_lib/auth.js';
import { normalizeCourse } from '../_lib/validate.js';

const COURSE_COLS = 'id, day, start, span, name, room, teacher, note, color';

async function findConflict(env, userId, course, excludeId) {
  const rows = await all(env, 'SELECT id, name, start, span FROM courses WHERE user_id = ? AND day = ?', userId, course.day);
  const s1 = course.start, e1 = course.start + course.span;
  return rows.find((r) => {
    if (excludeId && r.id === excludeId) return false;
    const s2 = r.start, e2 = r.start + r.span;
    return s1 < e2 && s2 < e1;
  }) || null;
}

export async function onRequest({ request, env }) {
  const { user, response } = await guard(request, env);
  if (response) return response;
  const method = request.method;

  // 列表
  if (method === 'GET') {
    const courses = await all(env, `SELECT ${COURSE_COLS} FROM courses WHERE user_id = ? ORDER BY day, start`, user.id);
    return json({ courses });
  }

  // 新建
  if (method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const course = normalizeCourse(body);
    if (!course) return json({ error: '课程名称不能为空' }, 400);

    const conflict = await findConflict(env, user.id, course, null);
    if (conflict) return json({ error: `与「${conflict.name}」时间冲突` }, 409);

    const id = uid();
    const ts = now();
    await run(
      env,
      `INSERT INTO courses (id, user_id, day, start, span, name, room, teacher, note, color, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id, user.id, course.day, course.start, course.span, course.name, course.room, course.teacher, course.note, course.color, ts, ts
    );
    return json(Object.assign({ id }, course), 201);
  }

  // 清空
  if (method === 'DELETE') {
    await run(env, 'DELETE FROM courses WHERE user_id = ?', user.id);
    return json({ ok: true });
  }

  return json({ error: '方法不支持' }, 405);
}
