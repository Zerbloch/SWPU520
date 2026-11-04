/**
 * 移动端 · 课表页
 * ------------------------------------------------------------
 * 移动端采用「按日 Tab + 课程卡片列表」布局（7 列网格在手机上太挤）：
 *   顶部：周徽标 + 标题 + 节次时间/导出按钮
 *   中部：星期横向滑动 Tab
 *   下部：当天课程卡片，点卡片编辑、点 + 添加
 * 课程编辑弹窗与节次时间弹窗沿用桌面端逻辑。
 */
import { $, $$, esc } from '/js/core/dom.js';
import { DAY_NAMES, PALETTE, DEFAULT_PERIOD_TIMES } from '/js/core/constants.js';
import { State, EVENTS, emit, on } from '/js/core/state.js';
import { openModal, toast } from '/js/core/ui.js';
import { Store, getPeriodTimes, periodTimeOf, currentWeekNumber } from '/js/data/courses.js';
import { exportBackup } from '/js/features/export.js';

let selectedDay = 0;

export default {
  id: 'timetable',
  label: '课表',
  icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/></svg>',

  render(root) {
    root.innerHTML = `
      <div class="m-page-head">
        <div>
          <div class="m-title-row">
            <h1>我的课表</h1>
            <span class="week-badge" id="tt-week" hidden>—</span>
          </div>
          <div class="m-sub">按天查看，点课程卡片修改或删除</div>
        </div>
        <div class="head-actions">
          <button class="btn btn-ghost btn-sm" id="tt-times">节次时间</button>
          <button class="btn btn-ghost btn-sm" id="tt-export">导出</button>
        </div>
      </div>

      <div class="m-days" id="m-days"></div>
      <div id="m-day-list"></div>

      <button class="btn btn-primary btn-block m-day-add" id="tt-add">+ 添加课程</button>
    `;
  },

  mount(root) {
    $('#tt-add').addEventListener('click', () => openCourseModal(null, { day: selectedDay }));
    $('#tt-times').addEventListener('click', openTimeEditor);
    $('#tt-export').addEventListener('click', exportBackup);

    $('#m-days').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-day]');
      if (!btn) return;
      selectedDay = Number(btn.dataset.day);
      renderDayTabs();
      renderDayList();
    });

    $('#m-day-list').addEventListener('click', (e) => {
      const el = e.target.closest('[data-edit-course]');
      if (!el) return;
      const c = State.data.courses.find((x) => x.id === el.dataset.editCourse);
      if (c) openCourseModal(c);
    });

    // 其他页面（概览）请求打开编辑器
    on(EVENTS.OPEN_COURSE_EDITOR, (payload) => {
      if (!payload) return;
      const preset = payload.preset || null;
      if (preset && preset.day != null) selectedDay = Number(preset.day);
      openCourseModal(payload.course || null, preset);
    });

    on(EVENTS.EDIT_PERIOD_TIMES, () => openTimeEditor());
  },

  refresh() {
    const week = currentWeekNumber();
    $('#tt-week').textContent = week ? '第 ' + week + ' 周' : '—';
    $('#tt-week').hidden = !week;

    // 默认选中今天（如果在显示范围内）
    const days = Number(State.data.prefs.days) || 7;
    const today = (new Date().getDay() + 6) % 7;
    if (selectedDay >= days) selectedDay = 0;
    if (selectedDay !== today && today < days && !this._picked) selectedDay = today;

    renderDayTabs();
    renderDayList();
  }
};

function renderWeekBadge() {
  const week = currentWeekNumber();
  const el = $('#tt-week');
  if (el) { el.textContent = week ? '第 ' + week + ' 周' : '—'; el.hidden = !week; }
}

function renderDayTabs() {
  const days = Number(State.data.prefs.days) || 7;
  const box = $('#m-days');
  if (!box) return;

  box.innerHTML = DAY_NAMES.slice(0, days).map((n, d) =>
    '<button class="m-day' + (d === selectedDay ? ' active' : '') + '" data-day="' + d + '">' +
      n.replace('周', '') + '</button>'
  ).join('');
}

function renderDayList() {
  if (!State.data) return;
  const box = $('#m-day-list');
  if (!box) return;

  const periods = Number(State.data.prefs.periods) || 12;
  const list = State.data.courses
    .filter((c) => Number(c.day) === selectedDay && Number(c.start) <= periods)
    .sort((a, b) => Number(a.start) - Number(b.start));

  if (!list.length) {
    box.innerHTML = '<div class="m-day-empty"><b>' + DAY_NAMES[selectedDay] +
      ' 没有课程</b><br/>点击下方按钮添加一门课</div>';
    return;
  }

  box.innerHTML = list.map((c) => {
    const start = Number(c.start);
    const end = start + (Number(c.span) || 1) - 1;
    const startAt = periodTimeOf(start);
    const color = c.color || '#5566f2';
    return '<div class="m-course" data-edit-course="' + esc(c.id) + '">' +
      '<div class="mc-bar" style="background:' + esc(color) + '"></div>' +
      '<div class="mc-main"><b>' + esc(c.name) + '</b>' +
        '<span>' + (startAt ? startAt + ' · ' : '') + '第' + start + '-' + end + '节' +
        (c.room ? ' · ' + esc(c.room) : '') + '</span>' +
        (c.note ? '<span class="mc-note">' + esc(c.note) + '</span>' : '') +
      '</div>' +
      '<span class="li-tag">' + esc(c.teacher || '—') + '</span>' +
    '</div>';
  }).join('');
}

/* =========================================================
   课程编辑弹窗（沿用桌面端逻辑）
   ========================================================= */
function openCourseModal(course, preset) {
  const prefs = State.data.prefs;
  const periods = Number(prefs.periods) || 12;
  const days = Number(prefs.days) || 7;
  const isEdit = !!course;

  const cur = course || Object.assign(
    { day: selectedDay, start: 1, span: 2, name: '', room: '', teacher: '', note: '', color: PALETTE[0] },
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
        '<label class="field"><span>开始</span><select id="c-start">' + startOpts + '</select></label>' +
        '<label class="field"><span>持续</span><select id="c-span">' + spanOpts + '</select></label>' +
      '</div>' +
      '<div class="form-row two">' +
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
    actions.push({ label: '删除课程', cls: 'btn-danger', onClick: () => deleteCourse(course.id) });
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
        day, start, span, name,
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
        return false;
      }

      selectedDay = day;
      renderDayTabs();
      renderDayList();
      renderWeekBadge();
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
  renderDayList();
  emit(EVENTS.COURSES_CHANGED);
  toast('课程已删除', 'ok');
}

/* =========================================================
   节次时间编辑（沿用桌面端逻辑）
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
            renderDayList();
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
