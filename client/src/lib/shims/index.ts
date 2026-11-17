/**
 * 兼容原先 `import { showConfirm } from '@client/src/lib/shims'` 的用法。
 */
export function showConfirm(message: string): Promise<boolean> {
  return Promise.resolve(window.confirm(message));
}
