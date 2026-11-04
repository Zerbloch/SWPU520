/**
 * 文件访问共享逻辑（普通用户 + 管理员复用）
 */

import { first } from './http.js';
import { kindOf } from './preview.js';

export const FILE_COLS = 'id, name, size, mime, visibility, created_at AS createdAt';

export function withKind(rows) {
  return rows.map((r) => Object.assign({}, r, { kind: kindOf(r.name) }));
}

/** 本人任意文件；他人仅 public；越权返回 null（下载/预览共用） */
export async function loadAccessibleFile(env, id, user) {
  const row = await first(env, 'SELECT * FROM files WHERE id = ?', id);
  if (!row) return null;
  if (row.user_id !== user.id && row.visibility !== 'public') return null;
  return row;
}

/** 管理员：任意文件（不做归属判断，调用方保证管理员权限） */
export async function loadFileAnyUser(env, id) {
  return first(env, 'SELECT * FROM files WHERE id = ?', id);
}
