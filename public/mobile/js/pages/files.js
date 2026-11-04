/**
 * 移动端 · 文件页
 * ------------------------------------------------------------
 * 两个标签：我的文件 / 公开库。
 * 上传前弹窗询问可见性与重命名（沿用桌面端 promptUpload 逻辑）。
 * 预览委托给 features/viewer.js。
 */
import { $, $$, esc } from '/js/core/dom.js';
import { fmtSize, fmtDateTime, hashColor } from '/js/core/format.js';
import { PALETTE, extOf, extColor } from '/js/core/constants.js';
import { State, EVENTS, emit } from '/js/core/state.js';
import { toast, confirmModal, openModal } from '/js/core/ui.js';
import { Files } from '/js/data/files.js';
import { openViewer } from '/js/features/viewer.js';

export default {
  id: 'files',
  label: '文件',
  icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V6a2 2 0 0 1 2-2h4l2 3h6a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z"/></svg>',

  render(root) {
    root.innerHTML = `
      <div class="m-page-head">
        <div>
          <h1>文件空间</h1>
          <div class="m-sub">公开文件所有同学都能看到并下载</div>
        </div>
      </div>

      <div class="seg" id="files-tabs" style="width:100%;margin-bottom:14px">
        <button class="seg-btn active" data-ftab="mine" style="flex:1">我的文件</button>
        <button class="seg-btn" data-ftab="public" style="flex:1">公开库</button>
      </div>

      <div class="notice" id="office-notice" hidden>
        Word / Excel / PPT 在线预览未启用：服务器未安装 LibreOffice。图片、PDF、文本可直接预览。
      </div>

      <div id="ftab-mine">
        <button class="btn btn-primary btn-block m-upload" id="btn-upload">+ 上传文件</button>
        <input type="file" id="file-input" multiple hidden />

        <div class="m-files-head">
          <span id="files-count">共 0 个文件</span>
          <span id="files-size">0 B</span>
        </div>
        <div id="file-list"></div>
      </div>

      <div id="ftab-public" hidden>
        <div class="m-files-head">
          <span id="public-count">共 0 个公开文件</span>
          <span class="vis-hint">来自所有用户标记为公开的文件</span>
        </div>
        <div id="public-list"></div>
      </div>
    `;
  },

  mount(root) {
    const input = $('#file-input');
    $('#btn-upload').addEventListener('click', () => input.click());
    input.addEventListener('change', (e) => {
      handleFiles(e.target.files);
      e.target.value = '';
    });

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

function canPreview(f) {
  return !!f.kind && f.kind !== 'none';
}

function renderMine() {
  const list = State.files;
  const total = list.reduce((s, f) => s + (f.size || 0), 0);
  $('#files-count').textContent = '共 ' + list.length + ' 个文件';
  $('#files-size').textContent = fmtSize(total);

  const box = $('#file-list');
  if (!list.length) {
    box.innerHTML = '<div class="empty"><b>还没有上传任何文件</b>点上方按钮上传课件、作业或笔记</div>';
    return;
  }

  box.innerHTML = list.map((f) => {
    const ext = extOf(f.name);
    const isPublic = f.visibility !== 'private';
    const needOffice = f.kind === 'office' && !State.officeReady;

    const actions =
      (canPreview(f)
        ? '<button data-preview="' + esc(f.id) + '"' + (needOffice ? ' style="opacity:.5"' : '') + '>预览</button>'
        : '') +
      '<button data-download="' + esc(f.id) + '">下载</button>' +
      '<button data-rename="' + esc(f.id) + '">重命名</button>' +
      '<button data-remove="' + esc(f.id) + '" class="danger">删除</button>';

    return '<div class="m-file">' +
      '<div class="mf-top">' +
        '<div class="file-ext" style="background:' + extColor(ext) + '">' + esc(ext) + '</div>' +
        '<div class="file-main"><b>' + esc(f.name) + '</b>' +
          '<span>' + fmtSize(f.size) + ' · ' + fmtDateTime(f.createdAt) + '</span></div>' +
        '<button class="pill ' + (isPublic ? 'public' : 'private') + '" ' +
          'data-vis-toggle="' + esc(f.id) + '" data-next="' + (isPublic ? 'private' : 'public') + '">' +
          (isPublic ? '公开' : '私人') + '</button>' +
      '</div>' +
      '<div class="mf-actions">' + actions + '</div>' +
    '</div>';
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

  const groups = [];
  const index = new Map();
  list.forEach((f) => {
    const key = f.ownerUsername || 'unknown';
    if (!index.has(key)) {
      const g = { key, name: f.ownerName || f.ownerUsername || '未知用户', isMine: !!f.isMine, files: [] };
      index.set(key, g);
      groups.push(g);
    }
    index.get(key).files.push(f);
  });

  groups.sort((a, b) => {
    if (a.isMine !== b.isMine) return a.isMine ? -1 : 1;
    return (b.files[0].createdAt || 0) - (a.files[0].createdAt || 0);
  });

  box.innerHTML = groups.map((g) => {
    const initial = String(g.name).slice(0, 1).toUpperCase();
    const rows = g.files.map((f) => {
      const ext = extOf(f.name);
      const actions =
        (canPreview(f) ? '<button data-preview="' + esc(f.id) + '">预览</button>' : '') +
        '<button data-download="' + esc(f.id) + '">下载</button>';
      return '<div class="m-file">' +
        '<div class="mf-top">' +
          '<div class="file-ext" style="background:' + extColor(ext) + '">' + esc(ext) + '</div>' +
          '<div class="file-main"><b>' + esc(f.name) + '</b>' +
            '<span>' + fmtSize(f.size) + ' · ' + fmtDateTime(f.createdAt) + '</span></div>' +
        '</div>' +
        '<div class="mf-actions">' + actions + '</div>' +
      '</div>';
    }).join('');

    return '<div class="owner-group">' +
      '<div class="owner-head">' +
        '<div class="owner-avatar" style="background:' + hashColor(g.key, PALETTE) + '">' + esc(initial) + '</div>' +
        '<div class="owner-name">' + (g.isMine ? '我' : esc(g.name)) + '</div>' +
        '<div class="owner-count">' + g.files.length + ' 个文件</div>' +
      '</div>' + rows +
    '</div>';
  }).join('');
}

/* =========================================================
   操作
   ========================================================= */
function promptUpload(file) {
  return new Promise((resolve) => {
    const body =
      '<div class="form-grid">' +
        '<div class="vis-row" style="margin:0"><b style="font-size:13.5px;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:60%">' + esc(file.name) + '</b>' +
          '<span style="font-size:12px;color:var(--muted)">' + fmtSize(file.size) + '</span></div>' +
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
  let saved = 0, skipped = 0, cancelled = 0;

  for (const f of arr) {
    if (f.size > MAX) { skipped++; continue; }

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

  openModal({
    title: '重命名文件',
    body: '<div class="form-grid">' +
      '<label class="field"><span>文件名称</span>' +
        '<input id="rn-name" maxlength="200" value="' + esc(meta.name) + '" /></label>' +
      '</div>',
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
      setTimeout(() => { const i = $('#rn-name'); i.focus(); i.select(); }, 60);
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
