import { json } from '../../_lib/http.js';
import { guard } from '../../_lib/auth.js';
import { getDigest } from '../../_lib/ai.js';

export async function onRequest({ request, env }) {
  const { user, response } = await guard(request, env);
  if (response) return response;

  const url = new URL(request.url);
  const force = url.searchParams.get('force') === '1';
  const result = await getDigest(env, user.id, force);

  return json({
    content: result.content,
    fromCache: result.fromCache,
    generatedAt: result.generatedAt,
    disabled: result.disabled || false
  });
}
