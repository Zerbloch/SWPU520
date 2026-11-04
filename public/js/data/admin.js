/**
 * 超级管理员接口
 * 所有请求都要求当前登录用户 role='admin'（后端强制校验）。
 * 跨用户查看走 /api/admin 命名空间，服务端不落访问日志。
 */
import { Api } from '../core/api.js';

export const Admin = {
  /** 列出所有用户 */
  async listUsers() {
    const res = await Api.get('/admin/users');
    return (res && res.users) || [];
  },

  /** 某用户的完整数据：{ user, courses, prefs, files } */
  userData(id) {
    return Api.get('/admin/users/' + encodeURIComponent(id) + '/data');
  },

  /** 管理员下载任意文件的地址（走 admin 命名空间，不留记录） */
  downloadUrl(id) {
    return '/api/admin/files/' + encodeURIComponent(id) + '/download';
  },

  /** 管理员预览任意文件的地址 */
  previewUrl(id) {
    return '/api/admin/files/' + encodeURIComponent(id) + '/preview';
  }
};
