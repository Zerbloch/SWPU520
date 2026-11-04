import { json } from '../../_lib/http.js';

/** 登录页读取：是否开放注册（关闭时前端隐藏注册入口） */
export async function onRequest({ env }) {
  return json({ registrationOpen: env.ALLOW_REGISTER === '1' });
}
