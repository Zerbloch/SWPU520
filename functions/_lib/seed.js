/**
 * 封闭系统种子账户（与 Node 版 server/lib/seed.js 一致）
 * 首次请求时惰性创建，幂等：已有账户只校正角色、不覆盖密码。
 */

import { makeSalt, hashPassword } from './crypto.js';
import { first, run, uid, now } from './http.js';

const SEED_USERS = [
  { username: 'User_101', password: 'SWPU520', role: 'user' },
  { username: 'User_102', password: 'SWPU520', role: 'user' },
  { username: 'User_103', password: 'SWPU520', role: 'user' },
  { username: 'User_104', password: 'SWPU520', role: 'user' },
  { username: 'User_105', password: 'SWPU520', role: 'user' },
  { username: 'User_106', password: '19361003EN', role: 'admin' }
];

let seeded = false;

export async function ensureSeedAccounts(env) {
  if (seeded) return;
  seeded = true;

  let created = 0;
  for (const u of SEED_USERS) {
    const row = await first(env, 'SELECT id, role FROM users WHERE username = ?', u.username);
    if (row) {
      if (row.role !== u.role) {
        await run(env, 'UPDATE users SET role = ? WHERE username = ?', u.role, u.username);
      }
      continue;
    }

    const salt = makeSalt();
    const hash = await hashPassword(u.password, salt);
    const id = uid();
    await run(
      env,
      'INSERT INTO users (id, username, nickname, salt, pass_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      id, u.username, u.username, salt, hash, u.role, now()
    );
    await run(env, 'INSERT OR IGNORE INTO prefs (user_id, days, periods) VALUES (?, 7, 12)', id);
    created++;
  }
  return created;
}
