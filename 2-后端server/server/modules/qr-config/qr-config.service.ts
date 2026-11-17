import { Injectable, Inject, Logger } from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@server/database/database.module';

import { eq } from 'drizzle-orm';

import { qrConfigs } from '@server/database/schema';
import type { QrConfig } from '@shared/api.interface';

const CONFIG_ID = '00000000-0000-0000-0000-000000000001';

@Injectable()
export class QrConfigService {
  private readonly logger = new Logger(QrConfigService.name);

  constructor(@Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase) {}

  async getConfig(): Promise<QrConfig> {
    const rows = await this.db
      .select()
      .from(qrConfigs)
      .where(eq(qrConfigs.id, CONFIG_ID))
      .limit(1);

    if (rows.length === 0) {
      return {
        id: CONFIG_ID,
        wechatQrUrl: '',
        alipayQrUrl: '',
        payeeNickname: '开发者',
        paymentNote: '',
        updatedAt: new Date().toISOString(),
      };
    }

    const row = rows[0];
    return {
      id: row.id,
      wechatQrUrl: row.wechatQrUrl ?? '',
      alipayQrUrl: row.alipayQrUrl ?? '',
      payeeNickname: row.payeeNickname ?? '开发者',
      paymentNote: row.paymentNote ?? '',
      updatedAt: new Date(row.updatedAt).toISOString(),
    };
  }

  async saveConfig(dto: {
    wechatQrUrl: string;
    alipayQrUrl: string;
    payeeNickname: string;
    paymentNote: string;
  }): Promise<QrConfig> {
    const existing = await this.db
      .select({ id: qrConfigs.id })
      .from(qrConfigs)
      .where(eq(qrConfigs.id, CONFIG_ID))
      .limit(1);

    if (existing.length === 0) {
      await this.db.insert(qrConfigs).values({
        id: CONFIG_ID,
        wechatQrUrl: dto.wechatQrUrl,
        alipayQrUrl: dto.alipayQrUrl,
        payeeNickname: dto.payeeNickname,
        paymentNote: dto.paymentNote,
      });
    } else {
      await this.db
        .update(qrConfigs)
        .set({
          wechatQrUrl: dto.wechatQrUrl,
          alipayQrUrl: dto.alipayQrUrl,
          payeeNickname: dto.payeeNickname,
          paymentNote: dto.paymentNote,
        })
        .where(eq(qrConfigs.id, CONFIG_ID));
    }

    return this.getConfig();
  }
}
