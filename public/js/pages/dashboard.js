/**
 * 概览页
 * ------------------------------------------------------------
 * 这是一个「页面模块」的标准范例：
 *   id / label / icon / styles  —— 元信息，shell 用来自动建导航和加载样式
 *   render(root)                —— 只负责产出 HTML，只调用一次
 *   mount(root)                 —— 绑定事件，只调用一次
 *   refresh()                   —— 每次进入页面、或数据变化时刷新
 *
 * 新增页面照着这个文件抄即可。
 */
import { $, esc } from '../core/dom.js';
import { fmtDate, fmtSize, fmtDateTime } from '../core/format.js';
import { DAY_NAMES, extOf, extColor } from '../core/constants.js';
import { State, EVENTS, emit, on } from '../core/state.js';
import { visibleCourses, periodTimeOf, currentWeekNumber } from '../data/courses.js';
import { Ai } from '../data/ai.js';

function greetingText(name) {
  const h = new Date().getHours();
  const g = h < 6 ? '夜深了' : h < 11 ? '早上好' : h < 14 ? '中午好'
    : h < 18 ? '下午好' : h < 23 ? '晚上好' : '夜深了';
  return g + '，' + name;
}

function todayIndex() {
  return (new Date().getDay() + 6) % 7;
}

export default {
  id: 'dashboard',
  label: '概览',
  styles: 'css/pages/dashboard.css',
  icon: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>',

  render(root) {
    root.innerHTML = `
      <div class="page-head">
        <div>
          <div class="dash-head-title">
            <h1 id="dash-greet">你好</h1>
            <div class="dash-week-row">
              <span class="week-badge" id="dash-week">—</span>
              <p id="dash-sub">今天是 —</p>
            </div>
          </div>
        </div>
        <div class="head-actions">
          <button class="btn btn-ghost" data-goto="files">上传文件</button>
          <button class="btn btn-primary" id="dash-add-course">+ 添加课程</button>
        </div>
      </div>

      <div class="stats">
        <div class="stat">
          <div class="k">课程总数</div>
          <div class="v" id="st-courses">0<small>门</small></div>
        </div>
        <div class="stat">
          <div class="k">本周课时</div>
          <div class="v" id="st-hours">0<small>节</small></div>
        </div>
        <div class="stat">
          <div class="k">文件数量</div>
          <div class="v" id="st-files">0<small>个</small></div>
        </div>
        <div class="stat">
          <div class="k">文件占用</div>
          <div class="v" id="st-size">0<small>B</small></div>
        </div>
      </div>

      <div class="dash-grid">
        <div class="card card-pad">
          <h3 class="sec-title">今日课程 <span class="li-tag" id="today-tag">—</span></h3>
          <div class="list" id="today-list"></div>
        </div>
        <div class="card card-pad">
          <h3 class="sec-title">最近文件
            <button class="btn btn-ghost btn-sm" data-goto="files">全部</button>
          </h3>
          <div class="list" id="recent-files"></div>
        </div>
      </div>

      <div class="ai-card" id="ai-card" hidden>
        <div class="ai-head">
          <span class="ai-badge">AI 助手</span>
          <span class="ai-title">今日安排</span>
          <span class="ai-status" id="ai-status"></span>
        </div>
        <div class="ai-body" id="ai-body"></div>
        <div class="ai-foot">
          <span class="ai-status" id="ai-generated"></span>
          <button class="btn btn-ghost ai-refresh-btn" id="ai-refresh">重新生成</button>
        </div>
      </div>
    `;
  },

  mount(root) {
    $('#dash-add-course').addEventListener('click', () => {
      // 交给课表页打开编辑弹窗，概览页不重复实现一份
      emit(EVENTS.OPEN_COURSE_EDITOR, { course: null, preset: { day: todayIndex() } });
    });

    // 点击今日课程 → 打开同一个编辑器
    $('#today-list').addEventListener('click', (e) => {
      const el = e.target.closest('[data-edit-course]');
      if (!el) return;
      const course = State.data.courses.find((c) => c.id === el.dataset.editCourse);
      if (course) emit(EVENTS.OPEN_COURSE_EDITOR, { course });
    });

    // AI 摘要：手动刷新按钮（服务端有缓存，重复点不会多花钱）
    $('#ai-refresh').addEventListener('click', () => loadAiDigest(true));

    // 数据变化时自动刷新，不需要其他页面来调用。
    // 课表/文件变了，AI 摘要的内容哈希也会变，需要重新生成（服务端会缓存判断）。
    on(EVENTS.COURSES_CHANGED, () => {
      if (State.page === 'dashboard') { this.refresh(); loadAiDigest(false); }
    });
    on(EVENTS.FILES_CHANGED, () => {
      if (State.page === 'dashboard') { this.refresh(); loadAiDigest(false); }
    });
    on(EVENTS.PREFS_CHANGED, () => { if (State.page === 'dashboard') this.refresh(); });
  },

  refresh() {
    if (!State.user || !State.data) return;

    const now = new Date();
    const name = State.user.nickname || State.user.username;

    $('#dash-greet').textContent = greetingText(name);
    $('#dash-sub').textContent =
      fmtDate(now.getTime()) + ' ' + DAY_NAMES[(now.getDay() + 6) % 7];

    // 第 X 周
    const week = currentWeekNumber();
    $('#dash-week').textContent = week ? '第 ' + week + ' 周' : '—';
    $('#dash-week').hidden = !week;

    const courses = visibleCourses();
    const totalPeriods = courses.reduce((s, c) => s + (Number(c.span) || 1), 0);

    $('#st-courses').innerHTML = courses.length + '<small>门</small>';
    $('#st-hours').innerHTML = totalPeriods + '<small>节</small>';
    $('#st-files').innerHTML = State.files.length + '<small>个</small>';

    const bytes = State.files.reduce((s, f) => s + (f.size || 0), 0);
    $('#st-size').innerHTML = fmtSize(bytes).replace(/ (\w+)$/, '<small>$1</small>');

    renderTodayCourses(courses);
    renderRecentFiles();

    // AI 摘要：首次进入时加载（此后由 FILES_CHANGED/COURSES_CHANGED 触发刷新）
    if (!this._aiLoaded) {
      this._aiLoaded = true;
      loadAiDigest(false);
    }
  }
};

/* =========================================================
   AI 摘要
   ========================================================= */
let aiLoading = false;

async function loadAiDigest(force) {
  if (aiLoading) return;
  aiLoading = true;

  const card = $('#ai-card');
  const body = $('#ai-body');
  const status = $('#ai-status');

  if (!card || !body) { aiLoading = false; return; }

  card.hidden = false;
  body.innerHTML = '<div class="ai-loading"><div class="spinner"></div>正在生成今日安排…</div>';
  status.textContent = force ? '重新生成中' : '';

  try {
    const res = await Ai.digest(force);
    if (res.disabled) {
      // 未配置大模型：隐藏卡片，不打扰
      card.hidden = true;
      aiLoading = false;
      return;
    }

    if (!res.content) {
      body.innerHTML = '<div class="ai-empty">暂无可总结的内容，先添加课程或上传文件吧。</div>';
      $('#ai-generated').textContent = '';
    } else {
      body.innerHTML = renderAiMarkdown(res.content);
      status.textContent = res.fromCache ? '缓存' : '已更新';
      $('#ai-generated').textContent = res.generatedAt
        ? '生成于 ' + fmtDateTime(res.generatedAt)
        : '';
    }
  } catch (e) {
    body.innerHTML = '<div class="ai-empty">AI 摘要加载失败：' + esc(e.message || '未知错误') + '</div>';
    status.textContent = '';
    $('#ai-generated').textContent = '';
  } finally {
    aiLoading = false;
  }
}

/**
 * 极简 Markdown 渲染：只处理标题、列表、段落、加粗。
 * 不引入完整 markdown 库（AI 输出是受控格式，这里够了），
 * 并且全程用 textContent 赋值，杜绝 XSS。
 */
function renderAiMarkdown(md) {
  const lines = String(md || '').split('\n');
  const out = [];
  let listOpen = false;

  const closeList = () => {
    if (listOpen) { out.push('</ul>'); listOpen = false; }
  };

  lines.forEach((raw) => {
    const line = raw.trim();

    if (/^##\s+/.test(line)) {
      closeList();
      out.push('<h2>' + esc(line.replace(/^##\s+/, '')) + '</h2>');
    } else if (/^###\s+/.test(line)) {
      closeList();
      out.push('<h2>' + esc(line.replace(/^###\s+/, '')) + '</h2>');
    } else if (/^[-*]\s+/.test(line)) {
      if (!listOpen) { out.push('<ul>'); listOpen = true; }
      out.push('<li>' + inlineAi(line.replace(/^[-*]\s+/, '')) + '</li>');
    } else if (/^\d+[.、]\s*/.test(line)) {
      if (!listOpen) { out.push('<ul>'); listOpen = true; }
      out.push('<li>' + inlineAi(line.replace(/^\d+[.、]\s*/, '')) + '</li>');
    } else if (line) {
      closeList();
      out.push('<p>' + inlineAi(line) + '</p>');
    }
  });
  closeList();

  return out.join('');
}

/** 行内加粗 **text** → <strong> */
function inlineAi(s) {
  return esc(s).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

function renderTodayCourses(courses) {
  const idx = todayIndex();
  const today = courses
    .filter((c) => Number(c.day) === idx)
    .sort((a, b) => Number(a.start) - Number(b.start));

  const tag = $('#today-tag');
  const box = $('#today-list');
  if (!tag || !box) return;

  tag.textContent = today.length ? today.length + ' 节课' : '无课';

  if (!today.length) {
    box.innerHTML = '<div class="empty"><b>今天没有课程</b>好好休息，或者去课表里加一门</div>';
    return;
  }

  box.innerHTML = today.map((c) => {
    const end = Number(c.start) + (Number(c.span) || 1) - 1;
    const startAt = periodTimeOf(c.start);
    return '<div class="list-item" data-edit-course="' + esc(c.id) + '" style="cursor:pointer">' +
      '<div class="li-bar" style="background:' + esc(c.color || '#5566f2') + '"></div>' +
      '<div class="li-main"><b>' + esc(c.name) + '</b>' +
        '<span>' + (startAt ? startAt + ' · ' : '') + '第' + c.start + '-' + end + '节' +
        (c.room ? ' · ' + esc(c.room) : '') + '</span></div>' +
      '<span class="li-tag">' + esc(c.teacher || '—') + '</span>' +
    '</div>';
  }).join('');
}

function renderRecentFiles() {
  const box = $('#recent-files');
  if (!box) return;

  const recent = State.files.slice(0, 4);
  if (!recent.length) {
    box.innerHTML = '<div class="empty"><b>还没有文件</b>去「文件」版块上传第一个吧</div>';
    return;
  }

  box.innerHTML = recent.map((f) => {
    const ext = extOf(f.name);
    return '<div class="list-item">' +
      '<div class="file-ext" style="background:' + extColor(ext) + '">' + esc(ext) + '</div>' +
      '<div class="li-main"><b>' + esc(f.name) + '</b>' +
      '<span>' + fmtSize(f.size) + ' · ' + fmtDate(f.createdAt) + '</span></div>' +
    '</div>';
  }).join('');
}
