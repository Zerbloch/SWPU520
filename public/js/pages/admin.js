/**
 * 超级管理员页（仅 role='admin' 可见）
 * ------------------------------------------------------------
 * 查看任意用户的课表（只读网格）与文件（预览 / 下载）。
 * 所有请求走 /api/admin，服务端不落访问日志（不留记录）。
 */
import { $, esc } from '../core/dom.js';
import { fmtSize, fmtDateTime } from '../core/format.js';
import { DAY_NAMES, DEFAULT_PERIOD_TIMES, extOf, extColor } from '../core/constants.js';
import { State } from '../core/state.js';
import { toast } from '../core/ui.js';
import { Admin } from '../data/admin.js';
import { openViewer } from '../features/viewer.js';

let users = [];
let selectedId = null;

export default {
  id: 'admin',
  label: '管理',
  adminOnly: true,
  styles: 'css/pages/admin.css',
  icon: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 4 5v6c0 5 3.4 9.7 8 11 4.6-1.3 8-6 8-11V5l-8-3Z"/><path d="m9 12 2 2 4-4"/></svg>',

  render(root) {
    root.innerHTML = `
      <div class="page-head">
        <div>
          <h1>管理</h1>
          <p>超级管理员 · 查看任意用户的课表与文件（不留下访问记录）</p>
        </div>
      </div>

      <div class="admin-wrap">
        <div class="card card-pad admin-users">
          <h3 class="sec-title">用户列表</h3>
          <div class="list" id="admin-user-list"></div>
        </div>

        <div class="admin-detail">
          <div class="card card-pad" style="margin-bottom:16px">
            <h3 class="sec-title" id="admin-target">请选择一名用户</h3>
            <div class="admin-grid" id="admin-tt"></div>
          </div>

          <div class="card card-pad">
            <h3 class="sec-title">文件</h3>
            <div class="admin-files" id="admin-files"></div>
          </div>
        </div>
      </div>
    `;
  },

  mount(root) {
    $('#admin-user-list').addEventListener('click', (e) => {
      const el = e.target.closest('[data-user]');
      if (!el) return;
      selectUser(el.dataset.user);
    });

    $('#admin-files').addEventListener('click', (e) => {
      const pv = e.target.closest('[data-preview]');
      if (pv) {
        const f = currentFile(pv.dataset.preview);
        if (f) openViewer(f, Admin.previewUrl(f.id));
        return;
      }
    });
  },

  refresh() {
    loadUsers();
  }
};

function currentFile(id) {
  const list = window.__adminFiles || [];
  return list.find((f) => f.id === id) || null;
}

async function loadUsers() {
  try {
    users = await Admin.listUsers();
  } catch (e) {
    users = [];
    toast('读取用户列表失败：' + (e.message || '未知错误'), 'error');
  }

  const box = $('#admin-user-list');
  if (!box) return;

  if (!users.length) {
    box.innerHTML = '<div class="empty"><b>暂无用户</b></div>';
    return;
  }

  box.innerHTML = users.map((u) => {
    const initial = String(u.nickname || u.username).slice(0, 1).toUpperCase();
    return '<div class="admin-user' + (u.id === selectedId ? ' sel' : '') + '" data-user="' + esc(u.id) + '">' +
      '<div class="avatar">' + esc(initial) + '</div>' +
      '<div class="umain"><b>' + esc(u.nickname || u.username) + '</b>' +
        '<span>@' + esc(u.username) + '</span></div>' +
      '<span class="role-badge' + (u.role === 'admin' ? ' admin' : '') + '">' +
        (u.role === 'admin' ? '管理员' : '用户') + '</span>' +
    '</div>';
  }).join('');

  if (selectedId) {
    const still = users.find((u) => u.id === selectedId);
    if (!still) selectedId = null;
  }
  if (selectedId) loadDetail(selectedId);
}

async function selectUser(id) {
  selectedId = id;
  // 高亮
  const box = $('#admin-user-list');
  if (box) {
    box.querySelectorAll('.admin-user').forEach((el) => {
      el.classList.toggle('sel', el.dataset.user === id);
    });
  }
  await loadDetail(id);
}

async function loadDetail(id) {
  let data;
  try {
    data = await Admin.userData(id);
  } catch (e) {
    toast('读取用户数据失败：' + (e.message || '未知错误'), 'error');
    return;
  }

  $('#admin-target').textContent = (data.user.nickname || data.user.username) +
    ' 的课表（' + data.courses.length + ' 门课）';
  window.__adminFiles = data.files || [];

  renderTimetable(data.courses || [], data.prefs || {});
  renderFiles(data.files || []);
}

function renderTimetable(courses, prefs) {
  const grid = $('#admin-tt');
  if (!grid) return;

  const days = Number(prefs.days) || 7;
  const periods = Number(prefs.periods) || 12;
  const times = (Array.isArray(prefs.periodTimes) && prefs.periodTimes.length)
    ? prefs.periodTimes : DEFAULT_PERIOD_TIMES;

  grid.style.gridTemplateColumns = '54px repeat(' + days + ', minmax(84px, 1fr))';
  grid.style.gridTemplateRows = 'auto repeat(' + periods + ', minmax(54px, auto))';

  // 所有格子都显式定位，避免自动流被课程块显式定位干扰
  let html = '<div class="ag-corner" style="grid-row:1;grid-column:1"></div>';
  for (let d = 0; d < days; d++) {
    html += '<div class="ag-day' + (d >= 5 ? ' weekend' : '') + '" style="grid-row:1;grid-column:' + (d + 2) + '">' +
      DAY_NAMES[d] + '</div>';
  }
  for (let p = 1; p <= periods; p++) {
    html += '<div class="ag-time" style="grid-row:' + (p + 1) + ';grid-column:1">' +
      '<b>' + p + '</b><span>' + (times[p - 1] || '') + '</span></div>';
    for (let d = 0; d < days; d++) {
      html += '<div class="ag-slot" style="grid-row:' + (p + 1) + ';grid-column:' + (d + 2) + '"></div>';
    }
  }

  courses.forEach((c) => {
    const day = Number(c.day);
    const start = Number(c.start);
    const span = Math.max(1, Number(c.span) || 1);
    if (day >= days || start > periods) return;
    const clipped = Math.min(span, periods - start + 1);
    const color = c.color || '#5566f2';
    html += '<div class="ag-course" style="grid-row:' + (start + 1) + ' / span ' + clipped +
      ';grid-column:' + (day + 2) + ';--c:' + esc(color) + '">' +
      '<b>' + esc(c.name) + '</b>' +
      (c.room ? '<span>' + esc(c.room) + '</span>' : '') +
      '</div>';
  });

  grid.innerHTML = html;
}

function renderFiles(files) {
  const box = $('#admin-files');
  if (!box) return;

  if (!files.length) {
    box.innerHTML = '<div class="empty"><b>该用户没有上传文件</b></div>';
    return;
  }

  box.innerHTML = files.map((f) => {
    const ext = extOf(f.name);
    const canPreview = !!f.kind && f.kind !== 'none';
    return '<div class="file-row">' +
      '<div class="file-ext" style="background:' + extColor(ext) + '">' + esc(ext) + '</div>' +
      '<div class="file-main"><b>' + esc(f.name) + '</b>' +
        '<span>' + fmtSize(f.size) + ' · ' + fmtDateTime(f.createdAt) + '</span></div>' +
      '<div class="file-actions">' +
        (canPreview
          ? '<button class="icon-btn" data-preview="' + esc(f.id) + '" title="预览">' +
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>' +
            '</button>'
          : '') +
        '<a class="icon-btn" href="' + Admin.downloadUrl(f.id) + '" title="下载">' +
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v12M7 11l5 5 5-5"/><path d="M4 20h16"/></svg>' +
        '</a>' +
      '</div>' +
    '</div>';
  }).join('');
}
