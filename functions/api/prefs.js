import { json, first, run } from '../_lib/http.js';
import { guard } from '../_lib/auth.js';
import { clampInt, normalizePeriodTimes, DEFAULT_PERIOD_TIMES, DATE_RE } from '../_lib/validate.js';

export async function onRequest({ request, env }) {
  const { user, response } = await guard(request, env);
  if (response) return response;
  const method = request.method;

  if (method === 'GET') {
    const row = await first(env, 'SELECT days, periods, period_times, term_start FROM prefs WHERE user_id = ?', user.id);
    const days = row ? row.days : 7;
    const periods = row ? row.periods : 12;
    let times = null;
    if (row && row.period_times) {
      try { times = JSON.parse(row.period_times); } catch (e) { times = null; }
    }
    times = normalizePeriodTimes(times, periods);
    if (!times || times.every((t) => !t)) times = DEFAULT_PERIOD_TIMES.slice(0, periods);
    return json({ days, periods, periodTimes: times, termStart: (row && row.term_start) || '' });
  }

  if (method === 'PUT') {
    const body = await request.json().catch(() => ({}));
    const days = clampInt(body.days, 5, 7, 7);
    const periods = clampInt(body.periods, 6, 14, 12);

    let times = normalizePeriodTimes(body.periodTimes, periods);
    if (!times) times = DEFAULT_PERIOD_TIMES.slice(0, periods);

    let termStart = '';
    if (body.termStart != null) {
      const raw = String(body.termStart).trim();
      termStart = DATE_RE.test(raw) ? raw : '';
    }

    await run(env, 'INSERT OR IGNORE INTO prefs (user_id, days, periods, period_times) VALUES (?, 7, 12, ?)', user.id, JSON.stringify(DEFAULT_PERIOD_TIMES));
    await run(env, 'UPDATE prefs SET days = ?, periods = ?, period_times = ?, term_start = ? WHERE user_id = ?', days, periods, JSON.stringify(times), termStart, user.id);
    return json({ days, periods, periodTimes: times, termStart });
  }

  return json({ error: '方法不支持' }, 405);
}
