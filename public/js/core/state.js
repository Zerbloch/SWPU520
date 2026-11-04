/**
 * 全局状态 + 事件总线
 * ------------------------------------------------------------
 * 页面之间不直接互相调用，一律通过 bus 发事件解耦：
 *   文件上传完 → emit('files:changed')
 *   概览页监听 → 自动刷新统计
 *
 * 这样新增页面时不需要去修改其他页面的代码。
 */

export const State = {
  user: null,                  // 当前登录用户
  data: null,                  // { courses, prefs }
  files: [],                   // 我的文件
  publicFiles: [],             // 公开库
  officeReady: false,          // 服务端是否装了 LibreOffice
  filesTab: 'mine',            // 文件页当前标签
  uploadVisibility: 'public',  // 上传默认可见性
  page: null                   // 当前页面 id
};

/** 事件名常量，避免各页面手写字符串写错 */
export const EVENTS = {
  COURSES_CHANGED: 'courses:changed',
  PREFS_CHANGED: 'prefs:changed',
  FILES_CHANGED: 'files:changed',
  USER_CHANGED: 'user:changed',

  // 跨页面动作：谁需要谁监听，避免页面之间互相 import 造成循环依赖
  OPEN_COURSE_EDITOR: 'course:open-editor',   // payload: { course, preset }
  EDIT_PERIOD_TIMES: 'timetable:edit-times',  // 打开「节次时间」弹窗
  LOGOUT: 'auth:logout'                       // 请求退出登录
};

const target = new EventTarget();

export function emit(name, detail) {
  target.dispatchEvent(new CustomEvent(name, { detail }));
}

/** 返回取消订阅函数，页面卸载时可调用 */
export function on(name, handler) {
  const listener = (e) => handler(e.detail);
  target.addEventListener(name, listener);
  return () => target.removeEventListener(name, listener);
}
