/**
 * 通用 UI：提示、模态框、动态样式加载
 * 任何页面都可以直接用，不需要各自实现一遍
 */
import { $, esc } from './dom.js';

/* ---------------- Toast ---------------- */

export function toast(msg, type) {
  const box = $('#toasts');
  if (!box) return;

  const el = document.createElement('div');
  el.className = 'toast' + (type ? ' ' + type : '');
  el.textContent = msg;
  box.appendChild(el);

  setTimeout(() => {
    el.style.transition = 'opacity .25s, transform .25s';
    el.style.opacity = '0';
    el.style.transform = 'translateX(14px)';
    setTimeout(() => el.remove(), 260);
  }, 2600);
}

/* ---------------- 模态框 ---------------- */

export const isModalOpen = () => !$('#modal-backdrop').hidden;

/**
 * @param {object} opts
 * @param {string} opts.title    标题
 * @param {string} opts.body     内容 HTML
 * @param {Array}  opts.actions  [{ label, cls, keep, onClick }]
 *                               onClick 返回 false 表示「校验没过，别关窗」
 * @param {Function} opts.onMount 内容插入后的回调（绑事件用）
 */
export function openModal(opts) {
  $('#modal-title').textContent = opts.title || '';
  $('#modal-body').innerHTML = opts.body || '';

  const foot = $('#modal-foot');
  foot.innerHTML = '';

  (opts.actions || []).forEach((action) => {
    const btn = document.createElement('button');
    btn.className = 'btn ' + (action.cls || 'btn-ghost');
    btn.textContent = action.label;

    btn.addEventListener('click', async () => {
      if (btn.disabled) return;
      btn.disabled = true;
      try {
        // 动作可能是异步的（要等接口），返回 false 时不关窗
        const result = action.onClick ? await action.onClick() : undefined;
        if (result !== false && !action.keep) closeModal();
      } catch (err) {
        toast(err.message || '操作失败', 'error');
      } finally {
        btn.disabled = false;
      }
    });

    foot.appendChild(btn);
  });

  $('#modal-backdrop').hidden = false;
  if (opts.onMount) opts.onMount();
}

export function closeModal() {
  const backdrop = $('#modal-backdrop');
  if (!backdrop || backdrop.hidden) return;
  backdrop.hidden = true;
  $('#modal-body').innerHTML = '';
  $('#modal-foot').innerHTML = '';
}

export function confirmModal(title, message, onConfirm) {
  openModal({
    title,
    body: '<p style="margin:0 0 6px;font-size:13.5px;line-height:1.7;color:var(--text-2)">' +
      esc(message) + '</p>',
    actions: [
      { label: '取消', cls: 'btn-ghost', onClick: () => {} },
      { label: '确定', cls: 'btn-primary', onClick: () => { onConfirm(); } }
    ]
  });
}

/* ---------------- 动态样式 ---------------- */

const loadedStyles = new Set();

/**
 * 按页面需要加载 CSS，同一文件只插一次。
 * 页面模块通过 `styles: 'css/pages/xxx.css'` 声明即可。
 */
export function loadStyles(href) {
  if (!href || loadedStyles.has(href)) return Promise.resolve();
  loadedStyles.add(href);

  return new Promise((resolve) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    // 样式加载失败不该阻塞页面渲染，静默放行
    link.onload = () => resolve();
    link.onerror = () => resolve();
    document.head.appendChild(link);
  });
}
