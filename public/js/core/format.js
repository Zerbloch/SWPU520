/**
 * 格式化工具
 */

export const fmtSize = (bytes) => {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return (i === 0 ? n : n.toFixed(n >= 10 ? 0 : 1)) + ' ' + units[i];
};

const pad = (x) => String(x).padStart(2, '0');

export const fmtDate = (ts) => {
  const d = new Date(ts);
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
};

export const fmtDateTime = (ts) => {
  const d = new Date(ts);
  return fmtDate(ts) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
};

/** #rrggbb → rgba(...)，用于课程色块的半透明背景 */
export const hexToRgba = (hex, a) => {
  const h = String(hex || '#5566f2').replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
};

/** 按字符串做稳定散列取色，同一个用户/ID 每次颜色一致 */
export const hashColor = (seed, palette) => {
  const s = String(seed || '?');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
};
