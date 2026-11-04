/**
 * 页面注册表
 * ============================================================
 * 新增一个版块，只需要两步：
 *
 *   1. 在 pages/ 下新建文件，导出一个符合下面结构的对象
 *      （直接复制 dashboard.js 改即可）
 *
 *        export default {
 *          id: 'notes',              // 唯一标识，也是导航 data-page 值
 *          label: '笔记',            // 侧边栏文字
 *          icon: '<svg .../>',       // 侧边栏图标
 *          styles: 'css/pages/notes.css',  // 可选，首次进入才加载
 *          render(root) { ... },     // 产出 HTML，只调用一次
 *          mount(root) { ... },      // 绑定事件，只调用一次
 *          refresh() { ... }         // 每次进入/数据变化时刷新
 *        }
 *
 *   2. 在下面 import 一行，并加进 pages 数组
 *
 * 不需要改 index.html，也不需要改 shell.js ——
 * 导航按钮、页面容器、样式加载都会自动完成。
 *
 * 页面之间不要互相 import，用 core/state.js 的 emit/on 通信。
 * ============================================================
 */
import dashboard from './dashboard.js';
import timetable from './timetable.js';
import files from './files.js';
import settings from './settings.js';
import admin from './admin.js';

/** 数组顺序 = 侧边栏顺序。adminOnly 页面只对超级管理员显示 */
export const pages = [
  dashboard,
  timetable,
  files,
  settings,
  admin
];
