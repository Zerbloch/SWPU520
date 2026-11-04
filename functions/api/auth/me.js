import { json } from '../../_lib/http.js';
import { getAuthUser } from '../../_lib/auth.js';

export async function onRequest({ request, env }) {
  const user = await getAuthUser(request, env);
  if (!user) return json({ error: '未登录或登录已过期' }, 401);
  return json({ user });
}
