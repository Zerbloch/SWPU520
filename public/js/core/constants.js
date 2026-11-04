/**
 * 常量与默认值
 * 业务相关的默认数据集中放这里，页面模块只引用不硬编码
 */

export const DAY_NAMES = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

/** 默认作息：用户没自定义过时使用 */
export const DEFAULT_PERIOD_TIMES = [
  '08:00', '08:55', '10:00', '10:55', '14:00', '14:55',
  '16:00', '16:55', '19:00', '19:55', '20:50', '21:45',
  '22:00', '22:30'
];

/** 课程色板，也用于用户头像配色 */
export const PALETTE = [
  '#5566f2', '#7c4dff', '#ec4899', '#f97316', '#eab308',
  '#0f9d76', '#06b6d4', '#3b82f6', '#e0464b', '#64748b'
];

export const DEFAULT_PREFS = {
  days: 7,
  periods: 12,
  periodTimes: DEFAULT_PERIOD_TIMES.slice(),
  termStart: ''   // 学期第一周起始日（YYYY-MM-DD），空则自动推算
};

/** 新账号预置的示例课表 */
export const SEED_COURSES = [
  { day: 0, start: 1, span: 2, name: '高等数学', room: '教1-203', teacher: '张老师', color: '#5566f2', note: '' },
  { day: 0, start: 3, span: 2, name: '大学英语', room: '外语楼305', teacher: '李老师', color: '#0f9d76', note: '' },
  { day: 1, start: 2, span: 2, name: '数据结构', room: '机房 A', teacher: '王老师', color: '#eab308', note: '带电脑' },
  { day: 2, start: 1, span: 2, name: '线性代数', room: '教2-101', teacher: '赵老师', color: '#7c4dff', note: '' },
  { day: 2, start: 5, span: 2, name: '大学物理', room: '教3-402', teacher: '吴老师', color: '#3b82f6', note: '' },
  { day: 3, start: 5, span: 2, name: '体育', room: '东操场', teacher: '孙老师', color: '#06b6d4', note: '穿运动鞋' },
  { day: 4, start: 3, span: 3, name: '课程设计', room: '实验楼402', teacher: '周老师', color: '#ec4899', note: '' }
];

export const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/;

/** 文件类型 → 扩展名徽标配色 */
export const EXT_COLORS = {
  pdf: '#e0464b', doc: '#2b579a', docx: '#2b579a', xls: '#1d7044', xlsx: '#1d7044',
  ppt: '#c43e1c', pptx: '#c43e1c', png: '#8b5cf6', jpg: '#8b5cf6', jpeg: '#8b5cf6',
  gif: '#8b5cf6', webp: '#8b5cf6', svg: '#f59e0b', zip: '#64748b', rar: '#64748b',
  txt: '#64748b', md: '#0f9d76', json: '#0f9d76', js: '#eab308', ts: '#3b82f6',
  html: '#f97316', css: '#06b6d4', mp4: '#ec4899', mp3: '#ec4899', csv: '#1d7044'
};

export const extOf = (name) => {
  const i = String(name || '').lastIndexOf('.');
  if (i < 0 || i === name.length - 1) return 'FILE';
  return name.slice(i + 1).toUpperCase().slice(0, 4);
};

export const extColor = (ext) => EXT_COLORS[String(ext).toLowerCase()] || '#94a3b8';
