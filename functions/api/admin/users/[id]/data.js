import { json, all, first } from '../../../../_lib/http.js';
import { guard, guardAdmin } from '../../../../_lib/auth.js';
import { withKind, FILE_COLS } from '../../../../_lib/files.js';

const COURSE_COLS = 'id, day, start, span, name, room, teacher, note, color';

export async function onRequest({ request, env, params }) {
  const { user, response } = await guard(request, env);
  if (response) return response;
  const adminErr = guardAdmin(user);
  if (adminErr) return adminErr;

  const target = await first(env, 'SELECT id, username, nickname, role, created_at AS createdAt FROM users WHERE id = ?', params.id);
  if (!target) return json({ error: '用户不存在' }, 404);

  const courses = await all(env, `SELECT ${COURSE_COLS} FROM courses WHERE user_id = ? ORDER BY day, start`, target.id);

  const prefsRow = await first(env, 'SELECT days, periods, period_times, term_start FROM prefs WHERE user_id = ?', target.id);
  const days = prefsRow ? prefsRow.days : 7;
  const periods = prefsRow ? prefsRow.periods : 12;
  let periodTimes = [];
  if (prefsRow && prefsRow.period_times) {
    try { periodTimes = JSON.parse(prefsRow.period_times); } catch (e) { periodTimes = []; }
  }

  const files = withKind(await all(env, `SELECT ${FILE_COLS} FROM files WHERE user_id = ? ORDER BY created_at DESC`, target.id));

  return json({
    user: target,
    courses,
    prefs: { days, periods, periodTimes, termStart: (prefsRow && prefsRow.term_start) || '' },
    files
  });
}
