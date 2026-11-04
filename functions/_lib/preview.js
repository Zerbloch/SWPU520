/**
 * 文件类型判断（预览用）
 * ------------------------------------------------------------
 * Cloudflare Workers 没有 LibreOffice，Office 文档只能下载，
 * 不支持在线预览（officeAvailable 恒为 false）。
 */

const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'avif', 'ico'];
const TEXT_EXTS = [
  'txt', 'md', 'markdown', 'json', 'js', 'mjs', 'ts', 'css', 'html', 'htm',
  'xml', 'yml', 'yaml', 'sql', 'log', 'csv', 'ini', 'conf', 'env',
  'sh', 'bat', 'py', 'java', 'c', 'cpp', 'h', 'go', 'rs', 'php', 'rb'
];
const OFFICE_EXTS = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp', 'rtf', 'pages', 'key', 'numbers'];

export const TEXT_PREVIEW_LIMIT = 2 * 1024 * 1024;

function extOf(name) {
  const i = String(name || '').lastIndexOf('.');
  if (i < 0 || i === name.length - 1) return '';
  return name.slice(i + 1).toLowerCase();
}

/** 返回 image | pdf | office | text | none */
export function kindOf(name) {
  const ext = extOf(name);
  if (IMAGE_EXTS.includes(ext)) return 'image';
  if (ext === 'pdf') return 'pdf';
  if (OFFICE_EXTS.includes(ext)) return 'office';
  if (TEXT_EXTS.includes(ext)) return 'text';
  return 'none';
}

export function officeAvailable() {
  return false;
}
