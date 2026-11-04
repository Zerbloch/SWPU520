/**
 * 账号相关接口
 */
import { Api } from '../core/api.js';
import { USERNAME_RE } from '../core/constants.js';

export const Auth = {
  async register({ username, nickname, password }) {
    if (!USERNAME_RE.test(username)) throw new Error('用户名需为 3-20 位字母、数字或下划线');
    if (!password || password.length < 6) throw new Error('密码至少 6 位');
    const res = await Api.post('/auth/register', { username, nickname, password });
    return res.user;
  },

  async login(username, password, remember) {
    const res = await Api.post('/auth/login', { username, password, remember: !!remember });
    return res.user;
  },

  async logout() {
    try { await Api.post('/auth/logout'); } catch (e) { /* 服务端失败不影响本地登出 */ }
  },

  /** 静默探测登录态：未登录返回 null，不弹错误 */
  async currentUser() {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
      if (!res.ok) return null;
      const data = await res.json();
      return data.user || null;
    } catch (e) {
      return null;
    }
  },

  async updateNickname(nickname) {
    const res = await Api.put('/user/profile', { nickname });
    return res.user;
  },

  changePassword(oldPassword, newPassword) {
    return Api.put('/user/password', { oldPassword, newPassword });
  },

  deleteAccount() {
    return Api.del('/user');
  }
};
