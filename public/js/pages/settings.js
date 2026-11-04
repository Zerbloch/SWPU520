/**
 * 设置页
 * ------------------------------------------------------------
 * 账号资料 / 课表参数 / 修改密码 / 数据管理 / 危险操作
 */
import { $, esc } from '../core/dom.js';
import { fmtDateTime } from '../core/format.js';
import { PALETTE } from '../core/constants.js';
import { State, EVENTS, emit } from '../core/state.js';
import { toast, confirmModal } from '../core/ui.js';
import { Auth } from '../data/auth.js';
import { Store, getPeriodTimes } from '../data/courses.js';
import { exportBackup } from '../features/export.js';

export default {
  id: 'settings',
  label: '设置',
  styles: 'css/pages/settings.css',
  icon: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.88-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9v0a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1Z"/></svg>',

  render(root) {
    root.innerHTML = `
      <div class="page-head">
        <div>
          <h1>设置</h1>
          <p>账号资料、课表参数与数据管理</p>
        </div>
      </div>

      <div class="settings-wrap">
        <div class="card card-pad">
          <h3 class="sec-title">账号资料</h3>
          <div class="set-row">
            <div class="txt"><b>显示昵称</b><span>展示在侧边栏与欢迎语中</span></div>
            <div class="ctl">
              <input id="set-name" style="width:180px" placeholder="昵称" />
              <button class="btn btn-primary btn-sm" id="save-name">保存</button>
            </div>
          </div>
          <div class="set-row">
            <div class="txt"><b>用户名</b><span>登录凭据，不可修改</span></div>
            <div class="ctl"><span class="mono" id="set-username">—</span></div>
          </div>
          <div class="set-row">
            <div class="txt"><b>注册时间</b><span>账号创建日期</span></div>
            <div class="ctl"><span class="mono" id="set-created">—</span></div>
          </div>
        </div>

        <div class="card card-pad">
          <h3 class="sec-title">课表参数</h3>
          <div class="set-row">
            <div class="txt"><b>显示天数</b><span>决定课表显示周一到周五还是含周末</span></div>
            <div class="ctl">
              <select id="set-days">
                <option value="5">周一 ~ 周五（5 天）</option>
                <option value="6">周一 ~ 周六（6 天）</option>
                <option value="7">周一 ~ 周日（7 天）</option>
              </select>
            </div>
          </div>
          <div class="set-row">
            <div class="txt"><b>每天节数</b><span>调小后超出范围的课程会隐藏</span></div>
            <div class="ctl">
              <select id="set-periods">
                <option value="8">8 节</option>
                <option value="10">10 节</option>
                <option value="12">12 节</option>
                <option value="14">14 节</option>
              </select>
            </div>
          </div>
          <div class="set-row">
            <div class="txt"><b>每节课时间</b><span>自定义每一节的上课时间，课表与概览同步生效</span></div>
            <div class="ctl"><button class="btn btn-ghost btn-sm" id="btn-edit-times">编辑时间</button></div>
          </div>
          <div class="set-row">
            <div class="txt"><b>学期第一周起始日</b><span>用于计算首页与课表的「第 X 周」，填第一周所在周一的日期</span></div>
            <div class="ctl">
              <input type="date" id="set-term-start" style="width:170px" />
              <button class="btn btn-primary btn-sm" id="save-term-start">保存</button>
            </div>
          </div>
          <div class="set-row">
            <div class="txt"><b>恢复示例课程</b><span>用一套示例课表覆盖当前内容</span></div>
            <div class="ctl"><button class="btn btn-ghost btn-sm" id="btn-seed">载入示例</button></div>
          </div>
        </div>

        <div class="card card-pad demo-hide">
          <h3 class="sec-title">修改密码</h3>
          <div class="form-grid">
            <label class="field"><span>当前密码</span><input type="password" id="pw-old" placeholder="请输入当前密码" /></label>
            <label class="field"><span>新密码</span><input type="password" id="pw-new" placeholder="至少 6 位" /></label>
            <label class="field"><span>确认新密码</span><input type="password" id="pw-new2" placeholder="再次输入新密码" /></label>
            <div><button class="btn btn-primary btn-sm" id="save-pw">更新密码</button></div>
          </div>
        </div>

        <div class="card card-pad">
          <h3 class="sec-title">数据管理</h3>
          <div class="set-row">
            <div class="txt"><b>导出全部数据</b><span>课表 + 偏好设置，保存为 JSON 备份</span></div>
            <div class="ctl"><button class="btn btn-ghost btn-sm" id="btn-export">导出 JSON</button></div>
          </div>
          <div class="set-row">
            <div class="txt"><b>导入数据</b><span>从 JSON 备份恢复（会覆盖当前课表）</span></div>
            <div class="ctl">
              <button class="btn btn-ghost btn-sm" id="btn-import">选择文件</button>
              <input type="file" id="import-input" accept=".json,application/json" hidden />
            </div>
          </div>
          <div class="set-row">
            <div class="txt"><b>清空课表</b><span>删除当前账号下的所有课程</span></div>
            <div class="ctl"><button class="btn btn-danger btn-sm" id="btn-clear-tt">清空</button></div>
          </div>
        </div>

        <div class="card card-pad danger-zone demo-hide">
          <h3 class="sec-title">危险操作</h3>
          <div class="set-row">
            <div class="txt"><b>删除账号</b><span>同时删除课程与已上传文件，不可恢复</span></div>
            <div class="ctl"><button class="btn btn-danger btn-sm" id="btn-delete-account">删除账号</button></div>
          </div>
        </div>
      </div>
    `;
  },

  mount(root) {
    /* ---------- 昵称 ---------- */
    $('#save-name').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      const v = $('#set-name').value.trim();
      if (!v) { toast('昵称不能为空', 'warn'); return; }

      btn.disabled = true;
      try {
        const updated = await Auth.updateNickname(v);
        State.user = Object.assign({}, State.user, { nickname: updated.nickname });
        emit(EVENTS.USER_CHANGED);
        toast('昵称已更新', 'ok');
      } catch (err) {
        toast(err.message || '保存失败', 'error');
      } finally {
        btn.disabled = false;
      }
    });

    /* ---------- 课表参数 ---------- */
    $('#set-days').addEventListener('change', async (e) => {
      const days = Number(e.target.value);
      try {
        // 必须把已有 periodTimes / termStart 一起回传，否则会被服务端重置
        const saved = await Store.savePrefs({
          days, periods: State.data.prefs.periods,
          periodTimes: getPeriodTimes(), termStart: State.data.prefs.termStart
        });
        State.data.prefs.days = days;
        if (saved && saved.periodTimes) State.data.prefs.periodTimes = saved.periodTimes;
        emit(EVENTS.PREFS_CHANGED);
        toast('显示天数已更新', 'ok');
      } catch (err) {
        e.target.value = String(State.data.prefs.days);
        toast(err.message || '保存失败', 'error');
      }
    });

    $('#set-periods').addEventListener('change', async (e) => {
      const periods = Number(e.target.value);
      try {
        const saved = await Store.savePrefs({
          days: State.data.prefs.days, periods,
          periodTimes: getPeriodTimes(), termStart: State.data.prefs.termStart
        });
        State.data.prefs.periods = periods;
        if (saved && saved.periodTimes) State.data.prefs.periodTimes = saved.periodTimes;
        const hidden = State.data.courses.filter((c) => Number(c.start) > periods).length;
        emit(EVENTS.PREFS_CHANGED);
        toast(hidden ? '已更新，有 ' + hidden + ' 门课程超出范围被隐藏' : '每天节数已更新', hidden ? 'warn' : 'ok');
      } catch (err) {
        e.target.value = String(State.data.prefs.periods);
        toast(err.message || '保存失败', 'error');
      }
    });

    // 交给课表页打开弹窗，设置页不重复实现一份
    $('#btn-edit-times').addEventListener('click', () => emit(EVENTS.EDIT_PERIOD_TIMES));

    // 学期起始日
    $('#save-term-start').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      const val = $('#set-term-start').value;

      btn.disabled = true;
      try {
        const saved = await Store.savePrefs({
          days: State.data.prefs.days,
          periods: State.data.prefs.periods,
          periodTimes: getPeriodTimes(),
          termStart: val || ''
        });
        State.data.prefs.termStart = saved.termStart || '';
        emit(EVENTS.PREFS_CHANGED);
        toast(val ? '学期起始日已保存' : '已清除，将自动推算周数', 'ok');
      } catch (err) {
        toast(err.message || '保存失败', 'error');
      } finally {
        btn.disabled = false;
      }
    });

    $('#btn-seed').addEventListener('click', () => {
      confirmModal('载入示例课表', '这会用一套示例课程覆盖当前账号下的所有课程，确定继续吗？', async () => {
        try {
          State.data.courses = await Store.seed();
          emit(EVENTS.COURSES_CHANGED);
          toast('示例课表已载入', 'ok');
        } catch (err) {
          toast(err.message || '载入失败', 'error');
        }
      });
    });

    /* ---------- 密码 ---------- */
    $('#save-pw').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      const oldPw = $('#pw-old').value;
      const np = $('#pw-new').value;
      const np2 = $('#pw-new2').value;

      if (!oldPw) { toast('请输入当前密码', 'warn'); return; }
      if (np.length < 6) { toast('新密码至少 6 位', 'warn'); return; }
      if (np !== np2) { toast('两次输入的新密码不一致', 'warn'); return; }

      btn.disabled = true;
      try {
        await Auth.changePassword(oldPw, np);
        $('#pw-old').value = ''; $('#pw-new').value = ''; $('#pw-new2').value = '';
        toast('密码已更新', 'ok');
      } catch (err) {
        toast(err.message || '修改失败', 'error');
      } finally {
        btn.disabled = false;
      }
    });

    /* ---------- 数据管理 ---------- */
    $('#btn-export').addEventListener('click', exportBackup);
    $('#btn-import').addEventListener('click', () => $('#import-input').click());

    $('#import-input').addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          if (!data || !Array.isArray(data.courses)) throw new Error('文件格式不正确');

          confirmModal('导入课表', '将导入 ' + data.courses.length + ' 门课程，并覆盖当前课表，确定吗？', async () => {
            const courses = data.courses.map((c) => ({
              day: Number(c.day) || 0,
              start: Number(c.start) || 1,
              span: Math.max(1, Number(c.span) || 1),
              name: String(c.name || '未命名课程'),
              room: String(c.room || ''),
              teacher: String(c.teacher || ''),
              note: String(c.note || ''),
              color: c.color || PALETTE[0]
            }));

            const prefs = data.prefs ? {
              days: Number(data.prefs.days) || 7,
              periods: Number(data.prefs.periods) || 12,
              periodTimes: Array.isArray(data.prefs.periodTimes) ? data.prefs.periodTimes : undefined
            } : null;

            try {
              const saved = await Store.replaceAll(courses, prefs);
              State.data.courses = saved;
              if (prefs) {
                State.data.prefs = Object.assign({}, State.data.prefs, {
                  days: prefs.days,
                  periods: prefs.periods,
                  periodTimes: prefs.periodTimes || State.data.prefs.periodTimes
                });
              }
              emit(EVENTS.COURSES_CHANGED);
              this.refresh();
              toast('导入成功，共 ' + saved.length + ' 门课程', 'ok');
            } catch (err) {
              toast('导入失败：' + (err.message || '服务端拒绝了该文件'), 'error');
            }
          });
        } catch (err) {
          toast('导入失败：' + (err.message || '文件无法解析'), 'error');
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    });

    $('#btn-clear-tt').addEventListener('click', () => {
      confirmModal('清空课表', '确定删除当前账号下的全部课程吗？此操作无法撤销。', async () => {
        try {
          await Store.clear();
          State.data.courses = [];
          emit(EVENTS.COURSES_CHANGED);
          toast('课表已清空', 'ok');
        } catch (err) {
          toast(err.message || '清空失败', 'error');
        }
      });
    });

    /* ---------- 危险操作 ---------- */
    $('#btn-delete-account').addEventListener('click', () => {
      confirmModal('删除账号', '将永久删除账号「' + State.user.username + '」及其全部课程与文件，不可恢复。确定继续吗？', async () => {
        try {
          await Auth.deleteAccount();
          emit(EVENTS.LOGOUT);
          toast('账号已删除', 'ok');
        } catch (err) {
          toast(err.message || '删除失败', 'error');
        }
      });
    });
  },

  refresh() {
    const u = State.user;
    if (!u) return;
    $('#set-name').value = u.nickname || u.username;
    $('#set-username').textContent = '@' + u.username;
    $('#set-created').textContent = fmtDateTime(u.createdAt);
    $('#set-days').value = String(State.data.prefs.days);
    $('#set-periods').value = String(State.data.prefs.periods);
    $('#set-term-start').value = State.data.prefs.termStart || '';
    $('#pw-old').value = ''; $('#pw-new').value = ''; $('#pw-new2').value = '';
  }
};
