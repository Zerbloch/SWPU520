/**
 * /api/* 中间件：确保封闭系统的预置账户存在（幂等）。
 */
import { ensureSeedAccounts } from '../_lib/seed.js';

export async function onRequest(context) {
  await ensureSeedAccounts(context.env);
  return context.next();
}
