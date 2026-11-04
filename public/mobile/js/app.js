/**
 * 移动端应用入口
 * 与桌面端 app.js 职责一致：注册页面、初始化预览器、绑定快捷键、启动。
 */
import { pages } from './pages/index.js';
import { initShell, boot } from './shell.js';
import { initViewer, isViewerOpen, closeViewer } from '/js/features/viewer.js';
import { isModalOpen, closeModal } from '/js/core/ui.js';

// 演示模式判定：后端在 DEMO_MODE=1 时给首页注入 <meta name="demo-mode">
window.__DEMO__ = !!document.querySelector('meta[name="demo-mode"]');

initShell(pages);
initViewer();

// Esc：优先关预览层，其次关模态框
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (isViewerOpen()) { closeViewer(); return; }
  if (isModalOpen()) closeModal();
});

// 兜底：未捕获异常至少让用户看到
window.addEventListener('error', (e) => {
  console.error('[未捕获异常]', e.error || e.message);
});

boot();
