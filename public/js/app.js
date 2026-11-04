/**
 * 应用入口
 * ------------------------------------------------------------
 * 只做三件事：
 *   1. 注册页面
 *   2. 初始化预览器等全局组件
 *   3. 绑定全局快捷键，然后启动
 */
import { pages } from './pages/index.js';
import { initShell, boot } from './shell.js';
import { initViewer, isViewerOpen, closeViewer } from './features/viewer.js';
import { isModalOpen, closeModal, toast } from './core/ui.js';

// 演示模式判定：后端在 DEMO_MODE=1 时给首页注入了 <meta name="demo-mode">
// 这里读出来，让 shell.js 跳过登录页并隐藏账号相关操作。
window.__DEMO__ = !!document.querySelector('meta[name="demo-mode"]');

initShell(pages);
initViewer();

// Esc：预览层是全屏的，优先关闭；其次关模态框
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (isViewerOpen()) { closeViewer(); return; }
  if (isModalOpen()) closeModal();
});

// 兜底：未捕获的异常至少让用户看到，而不是页面静默失效
window.addEventListener('error', (e) => {
  console.error('[未捕获异常]', e.error || e.message);
});
window.addEventListener('unhandledrejection', (e) => {
  console.error('[未处理的 Promise 异常]', e.reason);
  const msg = e.reason && e.reason.message;
  if (msg) toast(msg, 'error');
});

boot();
