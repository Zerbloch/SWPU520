/**
 * 文件页
 * ------------------------------------------------------------
 * 两个标签：我的文件 / 公开库
 * 上传时选可见性（默认公开），上传后可直接点标签切换
 * 预览委托给 features/viewer.js，本页只负责提供入口
 */
import { $, $$, esc } from '../core/dom.js';
import { fmtSize, fmtDateTime, hashColor } from '../core/format.js';
import { PALETTE, extOf, extColor } from '../core/constants.js';
import { State, EVENTS, emit } from '../core/state.js';
import { toast, confirmModal, openModal } from '../core/ui.js';
import { Files } from '../data/files.js';
import { openViewer } from '../features/viewer.js';

export default {
  id: 'files',
  label: '文件',
  styles: 'css/pages/files.css',
  icon: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V6a2 2 0 0 1 2-2h4l2 3h6a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z"/></svg>',

  render(root) {
    root.innerHTML = `
      <div class="page-head">
        <div>
          <h1>文件空间</h1>
          <p>上传时可选择公开或私人 — 公开文件所有同学都能看到并下载</p>
        </div>
        <div class="head-actions">
          <button class="btn btn-ghost" id="files-refresh">刷新</button>
        </div>
      </div>

      <div class="seg" id="files-tabs" style="margin-bottom:16px">
        <button class="seg-btn active" data-ftab="mine">我的文件</button>
        <button class="seg-btn" data-ftab="public">公开库</button>
      </div>

      <div class="notice" id="office-notice" hidden>
        <span>Word / Excel / PPT 在线预览未启用：服务器未安装 LibreOffice。图片、PDF、文本、代码可直接预览。</span>
      </div>

      <div id="ftab-mine">
        <div class="drop" id="drop">
          <div class="ico">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>
          </div>
          <h3>拖拽文件到这里，或点击选择</h3>
          <p>单文件上限 100MB · 支持任意格式</p>
          <input type="file" id="file-input" multiple hidden />
        </div>

        <div class="vis-row">
          <span class="vis-label">上传提示</span>
          <span class="vis-hint">上传时会询问可见性和是否需要重命名</span>
        </div>

        <div class="files-head">
          <span id="files-count">共 0 个文件</span>
          <span id="files-size">0 B</span>
        </div>
        <div class="list" id="file-list"></div>
      </div>

      <div id="ftab-public" hidden>
        <div class="files-head">
          <span id="public-count">共 0 个公开文件</span>
          <span class="vis-hint">来自所有用户标记为公开的文件</span>
        </div>
        <div class="list" id="public-list"></div>
      </div>
    `;
  },

  mount(root) {
    const drop = $('#drop');
    const input = $('#file-input');

    drop.addEventListener('click', () => input.click());
    input.addEventListener('change', (e) => {
      handleFiles(e.target.files);
      e.target.value = '';
    });

    ['dragenter', 'dragover'].forEach((ev) => {
      drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); });
    });
    ['dragleave', 'drop'].forEach((ev) => {
      drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); });
    });
    drop.addEventListener('drop', (e) => {
      if (e.dataTransfer && e.dataTransfer.files) handleFiles(e.dataTransfer.files);
    });

    $('#files-refresh').addEventListener('click', async () => {
      await this.refresh();
      toast('已刷新', 'ok');
    });

    // 标签切换
    $('#files-tabs').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-ftab]');
      if (!btn) return;
      State.filesTab = btn.dataset.ftab;
      root.querySelectorAll('#files-tabs .seg-btn').forEach((b) => {
        b.classList.toggle('active', b === btn);
      });
      $('#ftab-mine').hidden = State.filesTab !== 'mine';
      $('#ftab-public').hidden = State.filesTab !== 'public';
    });

    // 我的文件：预览 / 重命名 / 下载 / 可见性 / 删除
    $('#file-list').addEventListener('click', (e) => {
      const pv = e.target.closest('[data-preview]');
      if (pv) { openViewer(findFile(pv.dataset.preview)); return; }

      const rn = e.target.closest('[data-rename]');
      if (rn) { renameFile(rn.dataset.rename); return; }

      const vis = e.target.closest('[data-vis-toggle]');
      if (vis) { toggleVisibility(vis.dataset.visToggle, vis.dataset.next); return; }

      const dl = e.target.closest('[data-download]');
      if (dl) { Files.download(dl.dataset.download); return; }

      const rm = e.target.closest('[data-remove]');
      if (rm) { removeFile(rm.dataset.remove); }
    });

    // 公开库：预览 / 下载
    $('#public-list').addEventListener('click', (e) => {
      const pv = e.target.closest('[data-preview]');
      if (pv) { openViewer(findFile(pv.dataset.preview)); return; }

      const dl = e.target.closest('[data-download]');
      if (dl) Files.download(dl.dataset.download);
    });
  },

  async refresh() {
    if (!State.user) return;
    try {
      const [mine, pub] = await Promise.all([Files.list(), Files.listPublic()]);
      State.files = mine.files;
      State.publicFiles = pub.files;
      State.officeReady = mine.officeReady || pub.officeReady;
    } catch (e) {
      State.files = [];
      State.publicFiles = [];
      toast('读取文件列表失败：' + (e.message || '未知错误'), 'error');
    }
    renderAll();
  }
};

/* =========================================================
   渲染
   ========================================================= */
function findFile(id) {
  return State.files.concat(State.publicFiles).find((f) => f.id === id) || null;
}

function renderAll() {
  const notice = $('#office-notice');
  if (notice) notice.hidden = !!State.officeReady;

  renderMine();
  renderPublic();
}

function previewBtn(f) {
  if (!f.kind || f.kind === 'none') return '';
  const needOffice = f.kind === 'office' && !State.officeReady;
  return '<button class="icon-btn" data-preview="' + esc(f.id) + '" ' +
    'title="' + (needOffice ? '需要服务器安装 LibreOffice' : '预览') + '"' +
    (needOffice ? ' style="opacity:.45"' : '') + '>' +
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>' +
    '</button>';
}

function downloadBtn(id) {
  return '<button class="icon-btn" data-download="' + esc(id) + '" title="下载">' +
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v12M7 11l5 5 5-5"/><path d="M4 20h16"/></svg>' +
    '</button>';
}

function visibilityPill(f) {
  const isPublic = f.visibility !== 'private';
  return '<button class="pill ' + (isPublic ? 'public' : 'private') + '" ' +
    'data-vis-toggle="' + esc(f.id) + '" data-next="' + (isPublic ? 'private' : 'public') + '" ' +
    'title="点击切换为' + (isPublic ? '私人' : '公开') + '">' +
    (isPublic ? '公开' : '私人') + '</button>';
}

function fileRow(f, extra) {
  const ext = extOf(f.name);
  return '<div class="file-row">' +
    '<div class="file-ext" style="background:' + extColor(ext) + '">' + esc(ext) + '</div>' +
    '<div class="file-main"><b>' + esc(f.name) + '</b>' +
      '<span>' + fmtSize(f.size) + ' · ' + fmtDateTime(f.createdAt) + '</span></div>' +
    (extra || '') +
  '</div>';
}

function renderMine() {
  const list = State.files;
  const total = list.reduce((s, f) => s + (f.size || 0), 0);
  $('#files-count').textContent = '共 ' + list.length + ' 个文件';
  $('#files-size').textContent = fmtSize(total);

  const box = $('#file-list');
  if (!list.length) {
    box.innerHTML = '<div class="empty"><b>还没有上传任何文件</b>把课件、作业、笔记拖到上面的区域吧</div>';
    return;
  }

  box.innerHTML = list.map((f) => {
    const actions = '<div class="file-actions">' +
      previewBtn(f) +
      '<button class="icon-btn" data-rename="' + esc(f.id) + '" title="重命名">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>' +
      '</button>' +
      downloadBtn(f.id) +
      '<button class="icon-btn" data-remove="' + esc(f.id) + '" title="删除" style="color:#e0464b">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>' +
      '</button></div>';
    return fileRow(f, visibilityPill(f) + actions);
  }).join('');
}

function renderPublic() {
  const list = State.publicFiles;
  $('#public-count').textContent = '共 ' + list.length + ' 个公开文件';

  const box = $('#public-list');
  if (!list.length) {
    box.innerHTML = '<div class="empty"><b>公开库还是空的</b>把自己资料标记为「公开」，同学就能在这里找到</div>';
    return;
  }

  // 按上传者分组，谁传的一目了然
  const groups = [];
  const index = new Map();
  list.forEach((f) => {
    const key = f.ownerUsername || 'unknown';
    if (!index.has(key)) {
      const g = {
        key,
        name: f.ownerName || f.ownerUsername || '未知用户',
        isMine: !!f.isMine,
        files: []
      };
      index.set(key, g);
      groups.push(g);
    }
    index.get(key).files.push(f);
  });

  // 自己排最前，其余按各自最新上传时间倒序
  groups.sort((a, b) => {
    if (a.isMine !== b.isMine) return a.isMine ? -1 : 1;
    return (b.files[0].createdAt || 0) - (a.files[0].createdAt || 0);
  });

  box.innerHTML = groups.map((g) => {
    const initial = String(g.name).slice(0, 1).toUpperCase();
    const rows = g.files.map((f) =>
      fileRow(f, '<div class="file-actions">' + previewBtn(f) + downloadBtn(f.id) + '</div>')
    ).join('');

    return '<div class="owner-group">' +
      '<div class="owner-head">' +
        '<div class="owner-avatar" style="background:' + hashColor(g.key, PALETTE) + '">' + esc(initial) + '</div>' +
        '<div class="owner-name">' + (g.isMine ? '我' : esc(g.name)) + '</div>' +
        '<div class="owner-count">' + g.files.length + ' 个文件</div>' +
      '</div>' +
      '<div class="list">' + rows + '</div>' +
    '</div>';
  }).join('');
}

/* =========================================================
   操作
   ========================================================= */

/**
 * 上传前弹窗询问可见性与是否重命名。
 * 多文件时逐个询问，用户取消则跳过该文件。
 */
function promptUpload(file) {
  return new Promise((resolve) => {
    const body =
      '<div class="form-grid">' +
        '<div class="ai-head" style="margin:0"><b style="font-size:13.5px;color:var(--text)">' + esc(file.name) + '</b>' +
          '<span style="margin-left:auto;font-size:12px;color:var(--muted)">' + fmtSize(file.size) + '</span></div>' +
        '<label class="field"><span>文件名称（可重命名）</span>' +
          '<input id="up-name" maxlength="200" value="' + esc(file.name) + '" /></label>' +
        '<div class="field"><span>可见性</span>' +
          '<div class="seg" id="up-vis" style="align-self:flex-start">' +
            '<button type="button" class="seg-btn active" data-vis="public">公开</button>' +
            '<button type="button" class="seg-btn" data-vis="private">私人</button>' +
          '</div></div>' +
        '<p class="vis-hint" id="up-vis-hint" style="margin:0">公开：所有登录用户都能看到并下载</p>' +
      '</div>';

    let visibility = 'public';

    openModal({
      title: '上传文件',
      body,
      actions: [
        { label: '取消', cls: 'btn-ghost', onClick: () => resolve(null) },
        {
          label: '上传',
          cls: 'btn-primary',
          onClick: () => {
            const name = $('#up-name').value.trim();
            resolve({ visibility, name: name || file.name });
          }
        }
      ],
      onMount() {
        $('#up-vis').addEventListener('click', (e) => {
          const btn = e.target.closest('[data-vis]');
          if (!btn) return;
          visibility = btn.dataset.vis;
          $$('#up-vis .seg-btn').forEach((b) => b.classList.toggle('active', b === btn));
          $('#up-vis-hint').textContent = visibility === 'private'
            ? '私人：仅自己可见，不会出现在公开库'
            : '公开：所有登录用户都能看到并下载';
        });
        setTimeout(() => $('#up-name').focus(), 60);
      }
    });
  });
}

async function handleFiles(fileList) {
  if (!State.user) return;
  const arr = Array.prototype.slice.call(fileList);
  if (!arr.length) return;

  const MAX = 100 * 1024 * 1024;
  let saved = 0;
  let skipped = 0;
  let cancelled = 0;

  for (const f of arr) {
    if (f.size > MAX) { skipped++; continue; }

    // 逐个询问可见性与重命名
    const choice = await promptUpload(f);
    if (!choice) { cancelled++; continue; }

    try {
      await Files.upload(f, choice.visibility, choice.name);
      saved++;
    } catch (e) {
      toast('「' + f.name + '」上传失败：' + (e.message || '未知错误'), 'error');
    }
  }

  await refreshState();

  if (saved) toast('已上传 ' + saved + ' 个文件', 'ok');
  if (skipped) toast(skipped + ' 个文件超过 100MB 已跳过', 'warn');
  if (cancelled && !saved && !skipped) toast('已取消上传', 'warn');
}

async function toggleVisibility(id, next) {
  try {
    await Files.setVisibility(id, next);
    const local = State.files.find((f) => f.id === id);
    if (local) local.visibility = next;
    await refreshState();
    toast(next === 'public' ? '已设为公开，同学可以在公开库看到' : '已设为私人，仅自己可见', 'ok');
  } catch (e) {
    toast(e.message || '修改失败', 'error');
  }
}

function renameFile(id) {
  const meta = State.files.find((f) => f.id === id);
  if (!meta) return;

  const body =
    '<div class="form-grid">' +
      '<label class="field"><span>文件名称</span>' +
        '<input id="rn-name" maxlength="200" value="' + esc(meta.name) + '" /></label>' +
    '</div>';

  openModal({
    title: '重命名文件',
    body,
    actions: [
      { label: '取消', cls: 'btn-ghost', onClick: () => {} },
      {
        label: '保存',
        cls: 'btn-primary',
        onClick: async () => {
          const name = $('#rn-name').value.trim();
          if (!name) { toast('文件名不能为空', 'warn'); return false; }
          try {
            await Files.rename(id, name);
            const local = State.files.find((f) => f.id === id);
            if (local) local.name = name;
            await refreshState();
            toast('已重命名', 'ok');
          } catch (e) {
            toast(e.message || '重命名失败', 'error');
            return false;
          }
        }
      }
    ],
    onMount() {
      setTimeout(() => $('#rn-name').focus(), 60);
      // 全选方便直接改
      const input = $('#rn-name');
      input.select();
    }
  });
}

function removeFile(id) {
  const meta = State.files.find((f) => f.id === id);
  confirmModal('删除文件', '确定删除「' + (meta ? meta.name : '该文件') + '」吗？删除后无法恢复。', async () => {
    try {
      await Files.remove(id);
      await refreshState();
      toast('文件已删除', 'ok');
    } catch (e) {
      toast(e.message || '删除失败', 'error');
    }
  });
}

/** 重新拉数据并渲染，同时通知其他页面（概览统计） */
async function refreshState() {
  try {
    const [mine, pub] = await Promise.all([Files.list(), Files.listPublic()]);
    State.files = mine.files;
    State.publicFiles = pub.files;
    State.officeReady = mine.officeReady || pub.officeReady;
  } catch (e) { /* 保留旧数据 */ }
  renderAll();
  emit(EVENTS.FILES_CHANGED);
}
