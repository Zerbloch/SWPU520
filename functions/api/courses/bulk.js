import { json, run, uid, now } from '../../_lib/http.js';
import { guard } from '../../_lib/auth.js';
import { normalizeCourse, normalizePeriodTimes, DEFAULT_PERIOD_TIMES, clampInt, DATE_RE } from '../../_lib/validate.js';

/** 批量导入：整体覆盖，一个事务 */
export async function onRequest({ request, env }) {
  const { user, response } = await guard(request, env);
  if (response) return response;

  const body = await request.json().catch(() => ({}));
  const list = Array.isArray(body.courses) ? body.courses : null;
  if (!list) return json({ error: 'courses 必须是数组' }, 400);
  if (list.length > 200) return json({ error: '单次最多导入 200 门课程' }, 400);

  const normalized = list.map(normalizeCourse);
  const ts = now();

  const stmts = [env.DB.prepare('DELETE FROM courses WHERE user_id = ?').bind(user.id)];
  const saved = normalized.map((c) => {
    const id = uid();
    stmts.push(
      env.DB.prepare(
        `INSERT INTO courses (id, user_id, day, start, span, name, room, teacher, note, color, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(id, user.id, c.day, c.start, c.span, c.name, c.room, c.teacher, c.note, c.color, ts, ts)
    );
    return Object.assign({ id }, c);
  });

  if (body.prefs) {
    const pDays = clampInt(body.prefs.days, 5, 7, 7);
    const pPeriods = clampInt(body.prefs.periods, 6, 14, 12);
    const incomingTimes = normalizePeriodTimes(body.prefs.periodTimes, pPeriods);
    let termStart = '';
    if (body.prefs.termStart != null) {
      const raw = String(body.prefs.termStart).trim();
      termStart = DATE_RE.test(raw) ? raw : '';
    }
    stmts.push(
      env.DB.prepare(
        'UPDATE prefs SET days = ?, periods = ?, period_times = ?, term_start = ? WHERE user_id = ?'
      ).bind(pDays, pPeriods, JSON.stringify(incomingTimes || DEFAULT_PERIOD_TIMES.slice(0, pPeriods)), termStart, user.id)
    );
  }

  await env.DB.batch(stmts);
  return json({ courses: saved });
}
