/**
 * AI 摘要接口
 */
import { Api } from '../core/api.js';

export const Ai = {
  /** 获取每日摘要（带服务端缓存）。force=true 时强制重新生成 */
  async digest(force) {
    const res = await Api.get('/ai/digest' + (force ? '?force=1' : ''));
    return {
      content: (res && res.content) || '',
      fromCache: !!(res && res.fromCache),
      generatedAt: res && res.generatedAt,
      disabled: !!(res && res.disabled)
    };
  },

  /** 是否已配置大模型 */
  async status() {
    const res = await Api.get('/ai/status');
    return {
      configured: !!(res && res.configured),
      model: (res && res.model) || ''
    };
  }
};
