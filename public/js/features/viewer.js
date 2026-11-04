/**
 * 文件预览器（独立功能模块）
 * ------------------------------------------------------------
 * 任何页面都可以 `openViewer(file)` 复用，不绑定在文件页上。
 *
 * 为什么用 fetch 拿 blob 而不是直接给 iframe 设 src：
 * 接口出错时返回的是 JSON，直接嵌 iframe 会显示一坨乱码，
 * 用 fetch 才能把「未安装转换组件」这类提示清楚地弹给用户。
 */
import { $, esc } from '../core/dom.js';
import { fmtSize } from '../core/format.js';
import { toast } from '../core/ui.js';
import { Files } from '../data/files.js';

let objectUrl = null;
let currentFile = null;

export const isViewerOpen = () => !$('#viewer').hidden;

export function openViewer(file, previewUrl) {
  if (!file) return;

  if (!file.kind || file.kind === 'none') {
    toast('该文件类型暂不支持预览，请下载后查看', 'warn');
    return;
  }

  currentFile = file;

  $('#viewer-name').textContent = file.name;
  $('#viewer-meta').textContent = fmtSize(file.size) +
    (file.ownerName && !file.isMine ? ' · ' + file.ownerName : '');
  $('#viewer-body').innerHTML =
    '<div class="viewer-loading"><div class="spinner"></div>正在加载预览…</div>';
  $('#viewer').hidden = false;
  document.body.style.overflow = 'hidden';

  loadPreview(file, previewUrl);
}

async function loadPreview(file, previewUrl) {
  try {
    const res = await fetch(previewUrl || Files.previewUrl(file.id), { credentials: 'same-origin' });

    if (!res.ok) {
      let msg = '预览失败';
      try {
        const data = await res.json();
        msg = data.error || msg;
      } catch (e) { /* 非 JSON 响应 */ }
      throw new Error(msg);
    }

    // 等待期间用户可能已经关掉了预览
    if (!isViewerOpen()) return;

    const blob = await res.blob();
    if (!isViewerOpen()) return;

    if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = null; }
    objectUrl = URL.createObjectURL(blob);

    const body = $('#viewer-body');

    if (file.kind === 'image') {
      body.innerHTML = '<img alt="" />';
      body.querySelector('img').src = objectUrl;

    } else if (file.kind === 'text') {
      const text = await blob.text();
      body.innerHTML = '<pre></pre>';
      // textContent 而非 innerHTML：文件里的 HTML 不会被当成页面执行
      body.querySelector('pre').textContent = text;

    } else {
      // pdf，或 office 在服务端转好的 pdf
      body.innerHTML = '<iframe title="预览"></iframe>';
      body.querySelector('iframe').src = objectUrl;
    }

  } catch (e) {
    if (!isViewerOpen()) return;
    $('#viewer-body').innerHTML =
      '<div class="viewer-fail"><b>无法预览</b>' + esc(e.message || '未知错误') +
      '<br/><button class="viewer-btn" id="viewer-fallback">改为下载</button></div>';

    const fb = $('#viewer-fallback');
    if (fb) fb.addEventListener('click', () => Files.download(file.id));
  }
}

export function closeViewer() {
  const viewer = $('#viewer');
  if (!viewer || viewer.hidden) return;

  viewer.hidden = true;
  document.body.style.overflow = '';
  $('#viewer-body').innerHTML = '';
  currentFile = null;

  if (objectUrl) {
    URL.revokeObjectURL(objectUrl);
    objectUrl = null;
  }
}

/** 绑定工具栏按钮，只调一次 */
export function initViewer() {
  $('#viewer-close').addEventListener('click', closeViewer);
  $('#viewer-download').addEventListener('click', () => {
    if (currentFile) Files.download(currentFile.id);
  });
}
