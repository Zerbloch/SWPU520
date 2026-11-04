import { json, all } from '../../_lib/http.js';
import { guard } from '../../_lib/auth.js';
import { withKind } from '../../_lib/files.js';

/** 公开库：所有用户标记为公开的文件 */
export async function onRequest({ request, env }) {
  const { user, response } = await guard(request, env);
  if (response) return response;

  const rows = await all(
    env,
    `SELECT f.id, f.name, f.size, f.mime, f.created_at AS createdAt,
            u.nickname AS ownerName, u.username AS ownerUsername,
            CASE WHEN f.user_id = ? THEN 1 ELSE 0 END AS isMine
       FROM files f
       JOIN users u ON u.id = f.user_id
      WHERE f.visibility = 'public'
      ORDER BY f.created_at DESC
      LIMIT 300`,
    user.id
  );
  return json({ files: withKind(rows), officeReady: false });
}
