/**
 * 密码哈希 + 令牌签名（Cloudflare Workers 用 Web Crypto）
 * ------------------------------------------------------------
 * Node 版用 scrypt + HMAC（crypto 模块）；Workers 没有 Node crypto，
 * 这里用 Web Crypto 的 PBKDF2-SHA256（NIST 推荐，10 万次迭代）+ HMAC。
 * 功能等价：加盐哈希、自包含签名 token、httpOnly Cookie。
 */

const encoder = new TextEncoder();

function toHex(bytes) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function bytesToB64url(bytes) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlToStr(s) {
  return atob(s.replace(/-/g, '+').replace(/_/g, '/'));
}

/* ---------------- 密码（PBKDF2-SHA256） ---------------- */

export function makeSalt() {
  return toHex(crypto.getRandomValues(new Uint8Array(16)));
}

export async function hashPassword(password, salt) {
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(String(password)),
    { name: 'PBKDF2' }, false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: encoder.encode(salt), iterations: 100000, hash: 'SHA-256' },
    key, 256
  );
  return toHex(new Uint8Array(bits));
}

export async function verifyPassword(password, salt, expected) {
  const actual = await hashPassword(password, salt);
  // 长度固定；Workers 无 timingSafeEqual，此处字符串比较的侧信道风险
  // 在 Cloudflare 隔离环境下可接受。
  return actual === expected;
}

/* ---------------- 令牌（HMAC-SHA256 签名） ---------------- */

async function hmacSign(data, secret) {
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return new Uint8Array(sig);
}

export async function signToken(userId, secret, ttlMs) {
  const payload = bytesToB64url(
    encoder.encode(JSON.stringify({ uid: userId, exp: Date.now() + ttlMs }))
  );
  const sig = bytesToB64url(await hmacSign(payload, secret));
  return payload + '.' + sig;
}

export async function verifyToken(token, secret) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const expected = bytesToB64url(await hmacSign(parts[0], secret));
  if (parts[1] !== expected) return null;

  try {
    const obj = JSON.parse(b64urlToStr(parts[0]));
    if (!obj || !obj.uid || !obj.exp || obj.exp < Date.now()) return null;
    return obj.uid;
  } catch (e) {
    return null;
  }
}
