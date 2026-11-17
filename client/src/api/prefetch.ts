import type { User } from '@shared/api.interface';
import { orders, users } from './modules';

/**
 * 空闲时预热常用的列表接口，结果会进入 api/modules.ts 的 GET 缓存。
 * 这样用户切到「订单」「我的」等标签时直接命中缓存，不必再等一次网络往返。
 */
const warmed = new Set<string>();

function safeRun(task: Promise<unknown>): void {
  void task.catch(() => undefined);
}

export function warmBuyerCache(user: User): void {
  const key = `buyer:${user.id}`;
  if (warmed.has(key)) return;
  warmed.add(key);
  safeRun(orders.list({ buyerId: user.id, pageSize: 50 }));
  safeRun(users.notifications(user.id, { pageSize: 1 }));
}

export function warmRunnerCache(user: User): void {
  const key = `runner:${user.id}`;
  if (warmed.has(key)) return;
  warmed.add(key);
  safeRun(orders.list({ status: 'pending', excludeBuyerId: user.id, pageSize: 50 }));
  safeRun(orders.list({ runnerId: user.id }));
  safeRun(users.notifications(user.id, { pageSize: 1 }));
}
