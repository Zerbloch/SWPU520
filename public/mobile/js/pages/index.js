/**
 * 移动端页面注册表
 * ------------------------------------------------------------
 * 与桌面端同构：每个页面导出 { id, label, icon, render, mount, refresh }。
 * 新增版块只需在 pages/ 下新建文件，然后在这里 import 并加入数组，
 * 底部 TabBar 会自动生成，无需改 shell.js。
 */
import dashboard from './dashboard.js';
import timetable from './timetable.js';
import files from './files.js';
import settings from './settings.js';
import admin from './admin.js';

/** 数组顺序 = 底部 TabBar 顺序。adminOnly 页面只对超级管理员显示 */
export const pages = [
  dashboard,
  timetable,
  files,
  settings,
  admin
];
