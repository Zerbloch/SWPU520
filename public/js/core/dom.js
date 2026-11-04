/**
 * DOM 小工具
 * 所有页面共用，保持极简，不引入框架
 */

export const $ = (sel, root = document) => root.querySelector(sel);

export const $$ = (sel, root = document) =>
  Array.prototype.slice.call(root.querySelectorAll(sel));

/** 转义 HTML，拼模板字符串时必须用，防止 XSS */
export const esc = (s) =>
  String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));

/** 把 HTML 字符串变成元素，方便挂事件 */
export function htmlToEl(str) {
  const tpl = document.createElement('template');
  tpl.innerHTML = String(str).trim();
  return tpl.content.firstElementChild;
}

/** 事件委托：在容器上监听，命中 selector 才执行 */
export function delegate(root, type, selector, handler) {
  root.addEventListener(type, (e) => {
    const target = e.target.closest(selector);
    if (target && root.contains(target)) handler(e, target);
  });
}
