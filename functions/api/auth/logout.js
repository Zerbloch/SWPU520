import { json } from '../../_lib/http.js';
import { clearAuthCookie } from '../../_lib/auth.js';

export async function onRequest() {
  const headers = new Headers();
  clearAuthCookie(headers);
  return json({ ok: true }, 200, headers);
}
