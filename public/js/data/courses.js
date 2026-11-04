/**
 * 课表数据（存在服务端 SQLite）
 */
import { Api } from '../core/api.js';
import { DEFAULT_PREFS, DEFAULT_PERIOD_TIMES, SEED_COURSES } from '../core/constants.js';
import { State } from '../core/state.js';

export const Store = {
  /** 一次性把课表和偏好拉回来 */
  async load() {
    const [courseRes, prefs] = await Promise.all([
      Api.get('/courses'),
      Api.get('/prefs')
    ]);
    return {
      courses: (courseRes && courseRes.courses) || [],
      prefs: Object.assign({}, DEFAULT_PREFS, prefs || {})
    };
  },

  create(course) { return Api.post('/courses', course); },
  update(id, course) { return Api.put('/courses/' + encodeURIComponent(id), course); },
  remove(id) { return Api.del('/courses/' + encodeURIComponent(id)); },
  clear() { return Api.del('/courses'); },
  savePrefs(prefs) { return Api.put('/prefs', prefs); },

  /** 导入/示例：整体覆盖，服务端用事务保证要么全成功要么全回滚 */
  async replaceAll(courses, prefs) {
    const res = await Api.put('/courses/bulk', { courses, prefs });
    return (res && res.courses) || [];
  },

  async seed() {
    return this.replaceAll(SEED_COURSES, Object.assign({}, DEFAULT_PREFS));
  }
};

/* ---------------- 每节课时间 ---------------- */

/** 当前用户的自定义作息；没设置过则用默认 */
export function getPeriodTimes() {
  const p = State.data && State.data.prefs;
  const arr = p && Array.isArray(p.periodTimes) ? p.periodTimes : null;
  return arr && arr.length ? arr : DEFAULT_PERIOD_TIMES;
}

/** 第 n 节（1 起）的开始时间，没有返回空串 */
export function periodTimeOf(n) {
  return getPeriodTimes()[n - 1] || '';
}

/** 只有可见范围内的课程（天数/节数之外的隐藏掉） */
export function visibleCourses() {
  if (!State.data) return [];
  const prefs = State.data.prefs;
  return State.data.courses.filter(
    (c) => Number(c.day) < prefs.days && Number(c.start) <= prefs.periods
  );
}

/* ---------------- 学期周数 ---------------- */

/**
 * 计算当前处于「第几周」
 * 第一周从 termStart（学期第一周的周一）开始。
 * 未设置 termStart 时，回退为「从本学年 9 月 1 日所在的周算起」的粗略值。
 */
export function currentWeekNumber() {
  const prefs = State.data && State.data.prefs;
  const termStart = prefs && prefs.termStart ? prefs.termStart : '';

  let start;
  if (termStart) {
    start = parseDate(termStart);
  } else {
    start = defaultTermStart();
  }

  if (!start) return null;

  // 统一到「本周一」
  const now = new Date();
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));

  const diffDays = Math.floor((monday - start) / (1000 * 60 * 60 * 24));
  const week = Math.floor(diffDays / 7) + 1;

  // 起始日之前，或超出合理范围（比如超过 30 周）认为无效
  if (week < 1) return null;
  return week;
}

/** 解析 YYYY-MM-DD，失败返回 null */
function parseDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s));
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

/** 默认学期起始：本学年 9 月 1 日所在的周一 */
function defaultTermStart() {
  const now = new Date();
  let year = now.getFullYear();
  // 9 月前属于上一学年
  if (now.getMonth() < 8) year -= 1;

  const sep1 = new Date(year, 8, 1);
  sep1.setHours(0, 0, 0, 0);
  const monday = new Date(sep1);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return monday;
}
