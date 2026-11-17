import { Global, Module } from '@nestjs/common';
import postgres from 'postgres';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

export const DRIZZLE_DATABASE = 'DRIZZLE_DATABASE';
export type { PostgresJsDatabase };

/**
 * 自建数据库模块：用环境变量 DATABASE_URL 连接 PostgreSQL。
 *
 * SSL 策略（无需手动配置也能在 Railway / Render 上跑通）：
 * 1. DATABASE_SSL=true  → 强制开启；
 * 2. DATABASE_SSL=false → 强制关闭；
 * 3. 都不填时自动判断：托管公网库（Render / Neon / Supabase 等）或 URL 里带
 *    sslmode=require 的开启 SSL，其余（Railway 内网、本地库）关闭。
 */
function resolveSsl(url: string): boolean | 'require' {
  const flag = process.env.DATABASE_SSL;
  if (flag === 'true') return 'require';
  if (flag === 'false') return false;

  if (/sslmode=require/i.test(url)) return 'require';
  if (/render\.com|neon\.tech|supabase\.(com|co)|sslmode=verify/i.test(url)) {
    return 'require';
  }
  return false;
}

@Global()
@Module({
  providers: [
    {
      provide: DRIZZLE_DATABASE,
      useFactory: () => {
        const url = process.env.DATABASE_URL;
        if (!url) {
          throw new Error('缺少环境变量 DATABASE_URL');
        }
        const client = postgres(url, {
          max: Number(process.env.DATABASE_POOL_MAX || 5),
          ssl: resolveSsl(url),
          idle_timeout: 20,
        });
        return drizzle(client);
      },
    },
  ],
  exports: [DRIZZLE_DATABASE],
})
export class DatabaseModule {}
