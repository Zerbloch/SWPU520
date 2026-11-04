/**
 * AI 摘要服务（Cloudflare 版，逻辑与 Node 版一致）
 * 用 D1 做缓存，Web Crypto 做 SHA-256 内容哈希，fetch 调 OpenAI 兼容接口。
 */

import { all, first, run } from './http.js';

function config(env) {
  return {
    baseUrl: (env.AI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, ''),
    apiKey: env.AI_API_KEY || '',
    model: env.AI_MODEL || 'gpt-4o-mini',
    maxAgeMinutes: Number(env.AI_CACHE_MINUTES) || 30,
    maxTokens: Number(env.AI_MAX_TOKENS) || 800,
    maxFileChars: Number(env.AI_MAX_FILE_CHARS) || 3000
  };
}

export function isConfigured(env) {
  return !!env.AI_API_KEY;
}

async function sha256Hex(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/* ---------------- 数据采集 ---------------- */

const TEXT_RE = /\.(txt|md|markdown|json|js|ts|css|html|htm|xml|yml|yaml|sql|log|csv|ini|conf|env|sh|bat|py|java|c|h|cpp|go|rs|php|rb)$/i;

async function collectUserContext(env, userId, maxFileChars) {
  const files = await all(
    env, 'SELECT name, size, stored_name FROM files WHERE user_id = ? ORDER BY created_at DESC', userId
  );
  const courses = await all(
    env, 'SELECT day, start, span, name, room, teacher, note FROM courses WHERE user_id = ? ORDER BY day, start', userId
  );

  const parts = ['【文件清单与内容】'];
  if (!files.length) {
    parts.push('（无文件）');
  } else {
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      let body = '（二进制文件，仅能提供名称，无法读取正文）';
      if (TEXT_RE.test(f.name)) {
        try {
          const obj = await env.FILES.get(f.stored_name);
          if (obj) {
            const text = await obj.text();
            body = text.slice(0, maxFileChars);
          } else {
            body = '（读取失败）';
          }
        } catch (e) {
          body = '（读取失败）';
        }
      }
      parts.push(`${i + 1}. ${f.name}（${f.size} 字节）\n   内容：${body}`);
    }
  }

  parts.push('\n【课表】');
  if (!courses.length) {
    parts.push('（暂无课程）');
  } else {
    const dayNames = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
    courses.forEach((c) => {
      const day = dayNames[c.day] || ('周' + (c.day + 1));
      parts.push(
        `${day} 第${c.start}-${c.start + c.span - 1}节 ${c.name}` +
        (c.room ? ` @${c.room}` : '') +
        (c.teacher ? `（${c.teacher}）` : '') +
        (c.note ? ` 备注:${c.note}` : '')
      );
    });
  }

  return parts.join('\n');
}

async function contentHash(env, userId) {
  const files = await all(env, 'SELECT id, name, size FROM files WHERE user_id = ?', userId);
  const courses = await all(
    env, 'SELECT id, day, start, span, name, room, teacher, note, color, updated_at FROM courses WHERE user_id = ?', userId
  );
  const f = files.map((x) => `${x.id}|${x.name}|${x.size}`).join('\n');
  const c = courses.map((x) => [x.id, x.day, x.start, x.span, x.name, x.room, x.teacher, x.note, x.color, x.updated_at].join('|')).join('\n');
  return sha256Hex(f + '\n--\n' + c);
}

/* ---------------- 大模型调用 ---------------- */

async function callModel(env, cfg, userContext) {
  const now = new Date();
  const today = now.toLocaleDateString('zh-CN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][now.getDay()];
  const hour = now.getHours();
  const minute = String(now.getMinutes()).padStart(2, '0');

  const system = `你是一个贴心的校园助理。根据用户提供的文件内容和课表，帮 TA 梳理今天的安排。

今天是${today}（${weekday}），现在是 ${hour}:${minute}。

请严格按以下两部分输出（用 Markdown）：

## 今日事项
- 列出今天（${weekday}）要上的课（时间、地点、老师）
- 结合文件内容，提示可能有截止日期的作业/任务（如果文件里提到了日期或 deadline）
- 如果没有明显的作业线索，就只列课程，并给一句轻松的提醒

## 正在进行
- 判断当前时间点（${hour}点）有没有正在进行的课或活动
- 如果有，说明是什么、还剩多久；如果没有，提示下一节课或"现在比较空闲"

要求：
- 语气友好、具体，不要空话套话
- 只基于提供的信息，不要编造不存在的课程或作业
- 信息不足就如实说明，不要硬凑
- 总字数控制在 300 字以内`;

  const resp = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + cfg.apiKey
    },
    body: JSON.stringify({
      model: cfg.model,
      temperature: 0.4,
      max_tokens: cfg.maxTokens,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userContext }
      ]
    })
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`大模型接口错误 ${resp.status}：${text.slice(0, 200)}`);
  }

  const data = await resp.json();
  const content = data && data.choices && data.choices[0] && data.choices[0].message
    ? data.choices[0].message.content : '';
  return (content || '').trim();
}

/* ---------------- 缓存 ---------------- */

export async function getDigest(env, userId, force) {
  if (!isConfigured(env)) {
    return { content: '', fromCache: false, generatedAt: null, disabled: true };
  }

  const cfg = config(env);
  const hash = await contentHash(env, userId);
  const cached = await first(env, 'SELECT content, hash, updated_at FROM ai_digests WHERE user_id = ?', userId);
  const maxAgeMs = cfg.maxAgeMinutes * 60 * 1000;
  const ts = Date.now();

  if (!force && cached && cached.hash === hash && (ts - cached.updated_at) < maxAgeMs) {
    return { content: cached.content, fromCache: true, generatedAt: cached.updated_at };
  }

  const context = await collectUserContext(env, userId, cfg.maxFileChars);
  const content = await callModel(env, cfg, context);

  await run(
    env,
    `INSERT INTO ai_digests (user_id, content, hash, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET content = excluded.content, hash = excluded.hash, updated_at = excluded.updated_at`,
    userId, content, hash, ts
  );

  return { content, fromCache: false, generatedAt: ts };
}

export function status(env) {
  return { configured: isConfigured(env), model: (env.AI_MODEL || 'gpt-4o-mini') };
}
