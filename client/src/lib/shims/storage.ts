/**
 * 原平台的文件桶概念在自建部署里没有意义，固定返回一个占位值即可。
 */
export function getDefaultBucketId(): string {
  return 'local';
}
