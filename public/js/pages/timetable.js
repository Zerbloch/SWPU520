/**
 * 课表页
 * ------------------------------------------------------------
 * 对外暴露两件事：
 *   - 页面本身（render / refresh）
 *   - 通过事件 'course:open-editor' 让其他页面也能唤起课程编辑弹窗
 *     （概览页点今日课程就是这么做的，避免页面之间互相 import）
 */
import { $, $$, esc } from '../core/dom.js';
import { hexToRgba } from '../core/format.js';
import { DAY_NAMES, PALETTE, DEFAULT_PERIOD_TIMES } from '../core/constants.js';
import { State, EVENTS, emit, on } from '../core/state.js';
import { openModal, toast } from '../core/ui.js';
import { Store, getPeriodTimes, periodTimeOf, currentWeekNumber } from '../data/courses.js';
import { exportBackup } from '../features/export.js';

export default {
  id: 'timetable',
  label: '课表',
  styles: 'css/pages/timetable.css',
  icon: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/></svg>',

  render(root) {
    root.innerHTML = `
      <div class="page-head">
        <div>
          <div class="tt-title-row">
            <h1>我的课表</h1>
            <span class="week-badge" id="tt-week">—</span>
          </div>
          <p>点击空白格添加课程，点击课程块修改或删除</p>
        </div>
        <div class="head-actions">
          <button class="btn btn-ghost" id="tt-times">节次时间</button>
          <button class="btn btn-ghost" id="tt-export">导出</button>
          <button class="btn btn-primary" id="tt-add">+ 添加课程</button>
        </div>
      </div>

      <div class="tt-scroll">
        <div class="tt-grid" id="tt-grid"></div>
      </div>

      <div class="tt-legend">
        <span><i class="dot" style="background:#5566f2"></i>单击空白格：新增</span>
        <span><i class="dot" style="background:#0f9d76"></i>单击课程块：编辑 / 删除</span>
      </div>
    `;
  },

  mount(root) {
    $('#tt-add').addEventListener('click', () => openCourseModal(null));
    $('#tt-times').addEventListener('click', openTimeEditor);
    $('#tt-export').addEventListener('click', exportBackup);

    $('#tt-grid').addEventListener('click', (e) => {
      const courseEl = e.target.closest('[data-edit-course]');
      if (courseEl) {
        const c = State.data.courses.find((x) => x.id === courseEl.dataset.editCourse);
        if (c) openCourseModal(c);
        return;
      }
      const slot = e.target.closest('.tt-slot');
      if (slot) {
        openCourseModal(null, {
          day: Number(slot.dataset.day),
          start: Number(slot.dataset.start),
          span: 2
        });
      }
    });

    // 其他页面（概览）请求打开编辑器
    on(EVENTS.OPEN_COURSE_EDITOR, (payload) => {
      if (!payload) return;
      openCourseModal(payload.course || null, payload.preset || null);
    });

    // 设置页的「编辑时间」按钮走这里，避免跨页面拿函数
    on(EVENTS.EDIT_PERIOD_TIMES, () => openTimeEditor());
  },

  refresh() {
    renderGrid();
    renderWeekBadge();
  }
};

function renderWeekBadge() {
  const el = $('#tt-week');
  if (!el) return;
  const week = currentWeekNumber();
  if (week) {
    el.textContent = '第 ' + week + ' 周';
    el.hidden = false;
  } else {
    el.hidden = true;
  }
}

/* =========================================================
   课表网格渲染
   ========================================================= */
function renderGrid() {
  if (!State.data) return;
  const prefs = State.data.prefs;
  const days = Number(prefs.days) || 7;
  const periods = Number(prefs.periods) || 12;

  const grid = $('#tt-grid');
  if (!grid) return;

  grid.style.gridTemplateColumns = '58px repeat(' + days + ', minmax(96px, 1fr))';
  grid.style.gridTemplateRows = 'auto repeat(' + periods + ', minmax(62px, auto))';

  let html = '<div class="tt-corner"></div>';

  for (let d = 0; d < days; d++) {
    html += '<div class="tt-day' + (d >= 5 ? ' weekend' : '') + '" style="grid-row:1;grid-column:' + (d + 2) + '">' +
      DAY_NAMES[d] + '</div>';
  }

  for (let p = 1; p <= periods; p++) {
    html += '<div class="tt-time" style="grid-row:' + (p + 1) + ';grid-column:1">' +
      '<b>' + p + '</b><span>' + periodTimeOf(p) + '</span></div>';

    for (let d = 0; d < days; d++) {
      html += '<div class="tt-slot" data-day="' + d + '" data-start="' + p + '" ' +
        'style="grid-row:' + (p + 1) + ';grid-column:' + (d + 2) + '"></div>';
    }
  }

  State.data.courses.forEach((c) => {
    const day = Number(c.day);
    const start = Number(c.start);
    const span = Math.max(1, Number(c.span) || 1);
    if (day >= days || start > periods) return;

    const clipped = Math.min(span, periods - start + 1);
    const color = c.color || '#5566f2';
    const end = start + span - 1;

    html += '<div class="tt-course" data-edit-course="' + esc(c.id) + '" ' +
      'style="grid-row:' + (start + 1) + ' / span ' + clipped + ';grid-column:' + (day + 2) + ';' +
      '--c:' + esc(color) + ';background:' + hexToRgba(color, 0.13) + '">' +
      '<div class="tc-name">' + esc(c.name) + '</div>' +
      (c.room ? '<div class="tc-meta">' + esc(c.room) + '</div>' : '') +
      '<div class="tc-time">' + start + '-' + end + ' 节' + (c.teacher ? ' · ' + esc(c.teacher) : '') + '</div>' +
    '</div>';
  });

  grid.innerHTML = html;
}

/* =========================================================
   课程编辑弹窗
   ========================================================= */
function openCourseModal(course, preset) {
  const prefs = State.data.prefs;
  const periods = Number(prefs.periods) || 12;
  const days = Number(prefs.days) || 7;
  const isEdit = !!course;

  const cur = course || Object.assign(
    { day: 0, start: 1, span: 2, name: '', room: '', teacher: '', note: '', color: PALETTE[0] },
    preset || {}
  );

  let dayOpts = '';
  for (let d = 0; d < days; d++) {
    dayOpts += '<option value="' + d + '"' + (Number(cur.day) === d ? ' selected' : '') + '>' + DAY_NAMES[d] + '</option>';
  }
  let startOpts = '';
  for (let p = 1; p <= periods; p++) {
    startOpts += '<option value="' + p + '"' + (Number(cur.start) === p ? ' selected' : '') + '>第 ' + p + ' 节</option>';
  }
  let spanOpts = '';
  for (let s = 1; s <= 6; s++) {
    spanOpts += '<option value="' + s + '"' + (Number(cur.span) === s ? ' selected' : '') + '>' + s + ' 节</option>';
  }

  const swatches = PALETTE.map((c) =>
    '<button type="button" class="swatch' + (c === cur.color ? ' sel' : '') + '" data-color="' + c + '" ' +
    'style="background:' + c + '"></button>'
  ).join('');

  const body =
    '<div class="form-grid">' +
      '<label class="field"><span>课程名称</span>' +
        '<input id="c-name" maxlength="30" placeholder="例如：高等数学" value="' + esc(cur.name) + '" /></label>' +
      '<div class="form-row">' +
        '<label class="field"><span>星期</span><select id="c-day">' + dayOpts + '</select></label>' +
        '<label class="field"><span>开始节次</span><select id="c-start">' + startOpts + '</select></label>' +
        '<label class="field"><span>持续</span><select id="c-span">' + spanOpts + '</select></label>' +
      '</div>' +
      '<div class="form-row" style="grid-template-columns:1fr 1fr">' +
        '<label class="field"><span>上课地点</span>' +
          '<input id="c-room" maxlength="30" placeholder="选填" value="' + esc(cur.room || '') + '" /></label>' +
        '<label class="field"><span>任课老师</span>' +
          '<input id="c-teacher" maxlength="20" placeholder="选填" value="' + esc(cur.teacher || '') + '" /></label>' +
      '</div>' +
      '<label class="field"><span>备注</span>' +
        '<input id="c-note" maxlength="60" placeholder="选填，例如：带电脑" value="' + esc(cur.note || '') + '" /></label>' +
      '<div class="field"><span>标记颜色</span><div class="swatches" id="c-colors">' + swatches + '</div></div>' +
    '</div>';

  let pickedColor = cur.color || PALETTE[0];

  const actions = [];
  if (isEdit) {
    actions.push({
      label: '删除课程',
      cls: 'btn-danger',
      onClick: () => deleteCourse(course.id)
    });
  }
  actions.push({ label: '取消', cls: 'btn-ghost', onClick: () => {} });
  actions.push({
    label: isEdit ? '保存修改' : '添加课程',
    cls: 'btn-primary',
    onClick: async () => {
      const name = $('#c-name').value.trim();
      if (!name) { toast('请填写课程名称', 'warn'); $('#c-name').focus(); return false; }

      const day = Number($('#c-day').value);
      const start = Number($('#c-start').value);
      const span = Number($('#c-span').value);

      // 前端先挡一次，省一次往返；服务端还会再校验
      const clash = State.data.courses.find((c) =>
        c.id !== (course && course.id) &&
        Number(c.day) === day &&
        !(Number(c.start) + (Number(c.span) || 1) <= start || start + span <= Number(c.start))
      );
      if (clash) {
        toast('与「' + clash.name + '」时间冲突，请调整节次', 'warn');
        return false;
      }

      const payload = {
        day, start, span,
        name,
        room: $('#c-room').value.trim(),
        teacher: $('#c-teacher').value.trim(),
        note: $('#c-note').value.trim(),
        color: pickedColor
      };

      try {
        if (course) {
          const saved = await Store.update(course.id, payload);
          const idx = State.data.courses.findIndex((c) => c.id === course.id);
          if (idx >= 0) State.data.courses[idx] = saved;
          toast('课程已更新', 'ok');
        } else {
          const saved = await Store.create(payload);
          State.data.courses.push(saved);
          toast('课程已添加', 'ok');
        }
      } catch (err) {
        toast(err.message || '保存失败', 'error');
        return false;   // 失败保留弹窗，别丢用户刚填的内容
      }

      renderGrid();
      emit(EVENTS.COURSES_CHANGED);
    }
  });

  openModal({
    title: isEdit ? '编辑课程' : '添加课程',
    body,
    actions,
    onMount() {
      $$('#c-colors .swatch').forEach((btn) => {
        btn.addEventListener('click', () => {
          pickedColor = btn.dataset.color;
          $$('#c-colors .swatch').forEach((b) => b.classList.toggle('sel', b === btn));
        });
      });
      setTimeout(() => $('#c-name').focus(), 60);
    }
  });
}

async function deleteCourse(id) {
  try {
    await Store.remove(id);
  } catch (err) {
    toast(err.message || '删除失败', 'error');
    return false;
  }

  State.data.courses = State.data.courses.filter((c) => c.id !== id);
  renderGrid();
  emit(EVENTS.COURSES_CHANGED);
  toast('课程已删除', 'ok');
}

/* =========================================================
   节次时间编辑
   ========================================================= */
function openTimeEditor() {
  if (!State.data) return;

  const periods = Number(State.data.prefs.periods) || 12;
  const times = getPeriodTimes();

  let rows = '';
  for (let p = 1; p <= periods; p++) {
    rows += '<div class="time-row">' +
      '<span>第 ' + p + ' 节</span>' +
      '<input type="time" data-period="' + p + '" value="' + esc(times[p - 1] || '') + '" />' +
    '</div>';
  }

  openModal({
    title: '编辑每节课时间',
    body: '<p class="modal-hint">这是你个人的作息表，只影响你自己的课表显示。留空表示该节不显示时间。</p>' +
      '<div class="time-grid">' + rows + '</div>',
    actions: [
      {
        label: '恢复默认',
        cls: 'btn-ghost',
        keep: true,
        onClick: () => {
          $$('#modal-body input[data-period]').forEach((input) => {
            input.value = DEFAULT_PERIOD_TIMES[Number(input.dataset.period) - 1] || '';
          });
          toast('已填入默认时间，记得点保存', 'ok');
        }
      },
      { label: '取消', cls: 'btn-ghost', onClick: () => {} },
      {
        label: '保存',
        cls: 'btn-primary',
        onClick: async () => {
          const next = $$('#modal-body input[data-period]').map((i) => i.value || '');
          try {
            const saved = await Store.savePrefs({
              days: State.data.prefs.days,
              periods: State.data.prefs.periods,
              periodTimes: next,
              termStart: State.data.prefs.termStart
            });
            State.data.prefs.periodTimes = saved.periodTimes || next;
            renderGrid();
            emit(EVENTS.PREFS_CHANGED);
            toast('节次时间已保存', 'ok');
          } catch (err) {
            toast(err.message || '保存失败', 'error');
            return false;
          }
        }
      }
    ]
  });
}
