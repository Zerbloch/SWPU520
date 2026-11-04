/**
 * 应用外壳
 * ------------------------------------------------------------
 * 负责四件事，与具体业务无关：
 *   1. 根据页面注册表自动生成侧边栏导航
 *   2. 首次进入某页面时才创建 DOM、加载它的 CSS（懒加载）
 *   3. 登录 / 注册 / 登出 / 会话过期
 *   4. 全局事件（data-goto 跳转、用户信息刷新）
 *
 * 新增版块不需要改这个文件。
 */
import { $, $$, esc } from './core/dom.js';
import { State, EVENTS, emit, on } from './core/state.js';
import { USERNAME_RE, DEFAULT_PREFS } from './core/constants.js';
import { toast, loadStyles, closeModal, confirmModal } from './core/ui.js';
import { setUnauthorizedHandler } from './core/api.js';
import { Auth } from './data/auth.js';
import { Store } from './data/courses.js';
import { Files } from './data/files.js';

// 演示模式：在运行时实时读取（不能用模块顶层快照——ESM 的 import
// 会先于 app.js 里对 window.__DEMO__ 的赋值执行，顶层读到的是 undefined）。
const isDemo = () => !!window.__DEMO__;

let pages = [];
const sections = new Map();   // pageId -> <section> 元素（已创建的不再重建）
let registrationOpen = true;

/* =========================================================
   初始化
   ========================================================= */
/** 当前登录用户可见的页面：普通用户看不到 adminOnly 页面 */
function visiblePages() {
  return pages.filter((p) => !p.adminOnly || (State.user && State.user.role === 'admin'));
}

function renderNav() {
  const nav = $('#nav');
  nav.innerHTML = visiblePages().map((p) =>
    '<button class="nav-item" data-page="' + p.id + '" title="' + esc(p.label) + '">' +
      p.icon +
      '<span class="lbl">' + esc(p.label) + '</span>' +
    '</button>'
  ).join('');
}

export function initShell(pageList) {
  pages = pageList;

  $('#nav').addEventListener('click', (e) => {
    const btn = e.target.closest('.nav-item');
    if (btn) go(btn.dataset.page);
  });

  renderNav();
  bindAuthForms();
  bindShellEvents();

  // Api 遇到 401 时回调这里，避免 core/api.js 反向依赖 shell
  setUnauthorizedHandler(handleSessionExpired);
}

function bindShellEvents() {
  $('#btn-logout').addEventListener('click', () => {
    confirmModal('退出登录', '确定要退出当前账号吗？', () => emit(EVENTS.LOGOUT));
  });

  // 页面内任意 [data-goto="xxx"] 都能跳转
  document.addEventListener('click', (e) => {
    const g = e.target.closest('[data-goto]');
    if (g) go(g.dataset.goto);
  });

  on(EVENTS.LOGOUT, () => logout());
  on(EVENTS.USER_CHANGED, () => updateUserChip());
}

/* =========================================================
   页面切换（懒加载）
   ========================================================= */
export async function go(id) {
  const list = visiblePages();
  const page = list.find((p) => p.id === id) || list[0];
  if (!page) return;

  $$('#nav .nav-item').forEach((b) => b.classList.toggle('active', b.dataset.page === page.id));
  $$('#page-host .page').forEach((s) => s.classList.remove('active'));

  let section = sections.get(page.id);

  if (!section) {
    if (page.styles) await loadStyles(page.styles);

    section = document.createElement('section');
    section.className = 'page';
    section.id = 'page-' + page.id;
    $('#page-host').appendChild(section);

    page.render(section);
    if (page.mount) page.mount(section);

    sections.set(page.id, section);
  }

  section.classList.add('active');
  State.page = page.id;

  if (page.refresh) page.refresh();
}

/** 退出登录后清空已挂载的页面，避免下一个账号看到上一个账号的残留 DOM */
function resetSections() {
  sections.clear();
  $('#page-host').innerHTML = '';
}

/* =========================================================
   登录态
   ========================================================= */
function showAuth() {
  $('#auth-view').hidden = false;
  $('#app-view').hidden = true;
}

function showApp() {
  $('#auth-view').hidden = true;
  $('#app-view').hidden = false;
}

function setFormMsg(id, text, ok) {
  const el = $(id);
  if (!el) return;
  if (!text) { el.className = 'form-msg'; el.textContent = ''; return; }
  el.textContent = text;
  el.className = 'form-msg show' + (ok ? ' ok' : '');
}

function switchAuthPane(which) {
  $('#login-pane').hidden = which !== 'login';
  $('#register-pane').hidden = which === 'login';
}

function updateUserChip() {
  const u = State.user;
  if (!u) return;
  const name = u.nickname || u.username;
  $('#side-avatar').textContent = name.slice(0, 1).toUpperCase();
  $('#side-name').textContent = name;
  $('#side-user').textContent = '@' + u.username;
}

export async function enterApp(user) {
  State.user = user;
  renderNav();   // 角色确定后重建导航（管理员多一个「管理」入口）

  // 演示模式：标记 body，隐藏退出登录等操作
  if (isDemo()) {
    document.body.classList.add('demo-mode');
  }

  // 数据先拉回来再渲染，避免首屏闪一下空课表
  try {
    const [data, mine, pub] = await Promise.all([
      Store.load(), Files.list(), Files.listPublic()
    ]);
    State.data = data;
    State.files = mine.files;
    State.publicFiles = pub.files;
    State.officeReady = mine.officeReady || pub.officeReady;
  } catch (e) {
    State.data = { courses: [], prefs: Object.assign({}, DEFAULT_PREFS) };
    State.files = [];
    State.publicFiles = [];
    toast('数据加载失败：' + (e.message || '未知错误'), 'error');
  }

  updateUserChip();
  showApp();
  await go(State.page && sections.has(State.page) ? State.page : 'dashboard');
}

export async function logout() {
  await Auth.logout();

  State.user = null;
  State.data = null;
  State.files = [];
  State.publicFiles = [];
  State.page = null;

  closeModal();
  resetSections();
  renderNav();
  showAuth();
  switchAuthPane('login');
  setFormMsg('#login-msg', '');
  $('#login-pass').value = '';
}

let expiring = false;
function handleSessionExpired() {
  if (expiring) return;
  expiring = true;

  State.user = null;
  State.data = null;
  State.files = [];
  State.publicFiles = [];
  State.page = null;

  closeModal();
  resetSections();
  renderNav();
  showAuth();
  switchAuthPane('login');
  setFormMsg('#login-msg', '登录已过期，请重新登录');

  setTimeout(() => { expiring = false; }, 1500);
}

/* =========================================================
   登录 / 注册表单
   ========================================================= */
function bindAuthForms() {
  $('#go-register').addEventListener('click', () => {
    switchAuthPane('register');
    setFormMsg('#login-msg', '');
    setTimeout(() => $('#reg-user').focus(), 40);
  });

  $('#go-login').addEventListener('click', () => {
    switchAuthPane('login');
    setFormMsg('#register-msg', '');
    setTimeout(() => $('#login-user').focus(), 40);
  });

  // 一键体验：服务端已有 demo 就登录，没有则注册
  $('#btn-demo').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    const oldText = btn.textContent;
    btn.textContent = '准备中…';
    try {
      let user;
      try {
        user = await Auth.login('demo', 'demo123');
      } catch (err) {
        user = await Auth.register({ username: 'demo', nickname: '示例同学', password: 'demo123' });
        await Store.seed();
      }
      setFormMsg('#login-msg', '');
      await enterApp(user);
      toast('已进入示例账号', 'ok');
    } catch (err) {
      setFormMsg('#login-msg', err.message || '示例账号不可用，请手动注册', false);
    } finally {
      btn.disabled = false;
      btn.textContent = oldText;
    }
  });

  $('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type=submit]');
    const username = $('#login-user').value.trim();
    const password = $('#login-pass').value;

    if (!username || !password) { setFormMsg('#login-msg', '请填写用户名和密码'); return; }

    btn.disabled = true;
    btn.textContent = '登录中…';
    try {
      const user = await Auth.login(username, password, $('#login-remember').checked);
      setFormMsg('#login-msg', '');
      await enterApp(user);
    } catch (err) {
      setFormMsg('#login-msg', err.message || '登录失败');
    } finally {
      btn.disabled = false;
      btn.textContent = '登录';
    }
  });

  $('#register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type=submit]');
    const username = $('#reg-user').value.trim();
    const nickname = $('#reg-name').value.trim();
    const pass = $('#reg-pass').value;
    const pass2 = $('#reg-pass2').value;

    if (!username) { setFormMsg('#register-msg', '请填写用户名'); return; }
    if (!USERNAME_RE.test(username)) { setFormMsg('#register-msg', '用户名需为 3-20 位字母、数字或下划线'); return; }
    if (pass.length < 6) { setFormMsg('#register-msg', '密码至少 6 位'); return; }
    if (pass !== pass2) { setFormMsg('#register-msg', '两次输入的密码不一致'); return; }

    btn.disabled = true;
    btn.textContent = '创建中…';
    try {
      const user = await Auth.register({ username, nickname, password: pass });
      await Store.seed();
      setFormMsg('#register-msg', '');
      await enterApp(user);
      toast('账号已创建，已为你载入示例课表', 'ok');
    } catch (err) {
      setFormMsg('#register-msg', err.message || '注册失败');
    } finally {
      btn.disabled = false;
      btn.textContent = '注册并进入';
    }
  });
}

/* =========================================================
   注册开关
   ---------------------------------------------------------
   封闭系统下后端注册已关闭，前端据此隐藏「注册」「一键体验」入口。
   ========================================================= */
async function loadAuthMeta() {
  try {
    const res = await fetch('/api/auth/meta', { credentials: 'same-origin' });
    if (res.ok) {
      const data = await res.json();
      registrationOpen = !!data.registrationOpen;
    }
  } catch (e) { /* 拿不到就当开放，避免误伤 */ }
  applyRegistrationState();
}

function applyRegistrationState() {
  if (registrationOpen) return;
  const regLink = $('#go-register');
  const demoBtn = $('#btn-demo');
  if (regLink && regLink.closest('.auth-switch')) {
    regLink.closest('.auth-switch').style.display = 'none';
  }
  if (demoBtn) demoBtn.style.display = 'none';
}

/* =========================================================
   启动
   ========================================================= */
export async function boot() {
  await loadAuthMeta();

  // 演示模式：跳过登录页，直接用访客身份进入
  if (isDemo()) {
    const user = await Auth.currentUser();
    if (user) { await enterApp(user); return; }

    // 极少数情况（后端 DEMO_MODE 没同步开）回落到登录页
    showAuth();
    return;
  }

  const user = await Auth.currentUser();
  if (user) {
    await enterApp(user);
    return;
  }
  showAuth();
}
