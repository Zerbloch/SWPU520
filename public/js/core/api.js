/**
 * API 客户端
 * ------------------------------------------------------------
 * 统一处理：
 *   - JSON 序列化（FormData 交给浏览器自己设 Content-Type）
 *   - 错误提取（后端统一返回 { error: '中文提示' }）
 *   - 401 回调（由 shell 注册，避免这里反向依赖 shell 造成循环引用）
 */

let onUnauthorized = () => {};

/** shell 启动时注入：会话失效时该做什么（回登录页） */
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

export const Api = {
  async call(pathname, options) {
    const opt = Object.assign({ method: 'GET', credentials: 'same-origin' }, options || {});

    if (opt.body && !(opt.body instanceof FormData)) {
      opt.headers = Object.assign({ 'Content-Type': 'application/json' }, opt.headers || {});
      opt.body = JSON.stringify(opt.body);
    }

    let res;
    try {
      res = await fetch('/api' + pathname, opt);
    } catch (e) {
      throw new Error('网络异常，请确认服务端已启动');
    }

    const text = await res.text();
    let data = null;
    if (text) {
      try { data = JSON.parse(text); } catch (e) { data = null; }
    }

    if (!res.ok) {
      // 登录接口的 401 是「密码错」，不是「会话过期」
      if (res.status === 401 && pathname !== '/auth/login') onUnauthorized();
      throw new Error((data && data.error) || ('请求失败（' + res.status + '）'));
    }
    return data;
  },

  get(p) { return this.call(p); },
  post(p, body) { return this.call(p, { method: 'POST', body }); },
  put(p, body) { return this.call(p, { method: 'PUT', body }); },
  del(p) { return this.call(p, { method: 'DELETE' }); }
};
