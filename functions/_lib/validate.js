/**
 * 入参清洗与校验（与 Node 版 server/lib/validate.js 行为一致）
 */

export const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/;
export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const DEFAULT_PERIOD_TIMES = [
  '08:00', '08:55', '10:00', '10:55', '14:00', '14:55',
  '16:00', '16:55', '19:00', '19:55', '20:50', '21:45',
  '22:00', '22:30'
];

export function clampInt(value, min, max, fallback) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function safeStr(value, max) {
  return String(value == null ? '' : value).trim().slice(0, max);
}

/** 课程对象收敛；非法名返回 null（由调用方转 400） */
export function normalizeCourse(body) {
  const name = safeStr(body.name, 30);
  if (!name) return null;
  return {
    day: clampInt(body.day, 0, 6, 0),
    start: clampInt(body.start, 1, 20, 1),
    span: clampInt(body.span, 1, 6, 1),
    name,
    room: safeStr(body.room, 30),
    teacher: safeStr(body.teacher, 20),
    note: safeStr(body.note, 60),
    color: /^#[0-9a-fA-F]{6}$/.test(String(body.color || '')) ? String(body.color) : '#5566f2'
  };
}

export function normalizePeriodTimes(value, periods) {
  let arr = value;
  if (typeof arr === 'string') {
    try { arr = JSON.parse(arr); } catch (e) { arr = null; }
  }
  if (!Array.isArray(arr)) return null;

  const targetLen = Math.min(14, Math.max(periods, arr.length));
  const out = [];
  for (let i = 0; i < targetLen; i++) {
    const v = arr[i];
    out.push(typeof v === 'string' && TIME_RE.test(v.trim()) ? v.trim() : '');
  }
  return out;
}
