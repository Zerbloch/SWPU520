import { json } from '../../_lib/http.js';
import { guard } from '../../_lib/auth.js';
import { status } from '../../_lib/ai.js';

export async function onRequest({ request, env }) {
  const { user, response } = await guard(request, env);
  if (response) return response;
  return json(status(env));
}
