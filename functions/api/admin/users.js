import { json, all } from '../../_lib/http.js';
import { guard, guardAdmin } from '../../_lib/auth.js';

export async function onRequest({ request, env }) {
  const { user, response } = await guard(request, env);
  if (response) return response;
  const adminErr = guardAdmin(user);
  if (adminErr) return adminErr;

  const rows = await all(
    env,
    `SELECT id, username, nickname, role, created_at AS createdAt
       FROM users
      WHERE username != '__demo__'
      ORDER BY username`
  );
  return json({ users: rows });
}
