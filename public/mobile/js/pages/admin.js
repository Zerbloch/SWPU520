/**
 * 移动端 · 超级管理员页（仅 role='admin' 可见）
 * 查看任意用户的课表（按日列表）与文件（预览/下载）。
 */
import { $, esc } from '/js/core/dom.js';
import { fmtSize, fmtDateTime } from '/js/core/format.js';
import { DAY_NAMES, extOf, extColor } from '/js/core/constants.js';
import { toast } from '/js/core/ui.js';
import { Admin } from '/js/data/admin.js';
import { openViewer } from '/js/features/viewer.js';

let users = [];
let selectedId = null;

export default {
  id: 'admin',
  label: '管理',
  adminOnly: true,
  icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 4 5v6c0 5 3.4 9.7 8 11 4.6-1.3 8-6 8-11V5l-8-3Z"/><path d="m9 12 2 2 4-4"/></svg>',

  render(root) {
    root.innerHTML = `
      <div class="m-page-head">
        <div><h1>管理</h1><div class="m-sub">超级管理员 · 查看任意用户（不留记录）</div></div>
      </div>

      <div class="card card-pad m-card">
        <h3 class="sec-title">用户</h3>
        <div class="list" id="admin-user-list"></div>
      </div>

      <div class="card card-pad m-card">
        <h3 class="sec-title" id="admin-target">课表</h3>
        <div id="admin-tt"></div>
      </div>

      <div class="card card-pad m-card">
        <h3 class="sec-title">文件</h3>
        <div id="admin-files"></div>
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
        const f = (window.__adminFiles || []).find((x) => x.id === pv.dataset.preview);
        if (f) openViewer(f, Admin.previewUrl(f.id));
      }
    });
  },

  refresh() {
    loadUsers();
  }
};

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
    return '<div class="list-item m-user-item' + (u.id === selectedId ? ' sel' : '') + '" data-user="' + esc(u.id) + '">' +
      '<div class="avatar" style="width:32px;height:32px">' + esc(initial) + '</div>' +
      '<div class="li-main"><b>' + esc(u.nickname || u.username) + '</b>' +
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
  const box = $('#admin-user-list');
  if (box) {
    box.querySelectorAll('.m-user-item').forEach((el) => {
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
    ' 的课表（' + data.courses.length + ' 门）';
  window.__adminFiles = data.files || [];

  renderCourses(data.courses || []);
  renderFiles(data.files || []);
}

function renderCourses(courses) {
  const box = $('#admin-tt');
  if (!box) return;

  if (!courses.length) {
    box.innerHTML = '<div class="empty"><b>该用户没有课程</b></div>';
    return;
  }

  // 按星期分组
  const byDay = {};
  courses.forEach((c) => {
    const d = Number(c.day);
    (byDay[d] = byDay[d] || []).push(c);
  });

  let html = '';
  for (let d = 0; d < 7; d++) {
    const list = byDay[d];
    if (!list || !list.length) continue;
    html += '<div class="m-day-label">' + DAY_NAMES[d] + '</div>';
    html += list.map((c) => {
      const start = Number(c.start);
      const end = start + (Number(c.span) || 1) - 1;
      return '<div class="list-item">' +
        '<div class="li-bar" style="background:' + esc(c.color || '#5566f2') + '"></div>' +
        '<div class="li-main"><b>' + esc(c.name) + '</b>' +
          '<span>第' + start + '-' + end + '节' + (c.room ? ' · ' + esc(c.room) : '') + '</span></div>' +
        '<span class="li-tag">' + esc(c.teacher || '—') + '</span>' +
      '</div>';
    }).join('');
  }

  box.innerHTML = html;
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
    const actions =
      (canPreview ? '<button data-preview="' + esc(f.id) + '">预览</button>' : '') +
      '<a href="' + Admin.downloadUrl(f.id) + '" style="text-decoration:none;color:inherit">下载</a>';

    return '<div class="m-file">' +
      '<div class="mf-top">' +
        '<div class="file-ext" style="background:' + extColor(ext) + '">' + esc(ext) + '</div>' +
        '<div class="file-main"><b>' + esc(f.name) + '</b>' +
          '<span>' + fmtSize(f.size) + ' · ' + fmtDateTime(f.createdAt) + '</span></div>' +
      '</div>' +
      '<div class="mf-actions">' + actions + '</div>' +
    '</div>';
  }).join('');
}
