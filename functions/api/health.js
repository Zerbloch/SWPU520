import { json } from '../_lib/http.js';

/**
 * 健康检查 + 自诊断。
 * 返回体里带 bindings / env / secrets 三组信息，用来区分：
 *   - 绑定没加 / 变量名写错  → bindings.DB 为 false
 *   - 加到了 Preview 环境    → 看 env.branch（production 应为 main）
 *   - 部署不是最新一次       → 看 env.commit 是否等于 GitHub 最新 commit
 * 不返回任何密钥值，只返回布尔与公开的构建信息。
 */
export async function onRequest({ env }) {
  const hasDB = !!env.DB;
  const hasFiles = !!env.FILES;

  const info = {
    bindings: { DB: hasDB, FILES: hasFiles },
    env: {
      branch: env.CF_PAGES_BRANCH || null,
      commit: (env.CF_PAGES_COMMIT_SHA || '').slice(0, 7) || null,
      url: env.CF_PAGES_URL || null
    },
    secrets: {
      APP_SECRET: !!env.APP_SECRET,
      AI_API_KEY: !!env.AI_API_KEY
    }
  };

  if (!hasDB) {
    return json({
      ok: false,
      error: 'DB 绑定缺失：env.DB 为 undefined',
      hint: 'Settings → Bindings 里检查变量名是否为 DB（区分大小写），并确认加在 Production 环境；保存后必须 Retry deployment',
      ...info
    }, 503);
  }

  try {
    await env.DB.prepare('SELECT 1').run();
    return json({ ok: true, ...info });
  } catch (e) {
    return json({
      ok: false,
      error: '数据库不可达：' + (e.message || '未知错误'),
      hint: '绑定存在但连不上，通常是 D1 数据库被删除或 ID 指向了别的库',
      ...info
    }, 503);
  }
}
