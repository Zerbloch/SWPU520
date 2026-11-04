/**
 * 数据备份导出
 * 设置页和课表页都用这一份，避免各写一遍
 */
import { fmtDate } from '../core/format.js';
import { toast } from '../core/ui.js';
import { State } from '../core/state.js';

export function exportBackup() {
  if (!State.user || !State.data) return;

  const payload = {
    app: 'campus-desk',
    version: 1,
    exportedAt: new Date().toISOString(),
    user: { username: State.user.username, nickname: State.user.nickname },
    prefs: State.data.prefs,
    courses: State.data.courses
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = 'campus-desk-' + State.user.username + '-' + fmtDate(Date.now()) + '.json';
  document.body.appendChild(a);
  a.click();
  a.remove();

  setTimeout(() => URL.revokeObjectURL(url), 4000);
  toast('备份已导出', 'ok');
}
