import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@server/database/database.module';
import { eq, and, desc, count, sql } from 'drizzle-orm';

import { fundTransactions } from '@server/database/schema';
import type { FundTransaction, FundTxStatus } from '@shared/api.interface';
import { CreateFundTxDto } from './dto/create-fund-tx.dto';

function mapFundTx(row: typeof fundTransactions.$inferSelect): FundTransaction {
  return {
    id: row.id,
    orderId: row.orderId ?? null,
    txType: row.txType as FundTransaction['txType'],
    amountFen: row.amountFen,
    direction: row.direction as 'in' | 'out',
    channel: row.channel,
    status: row.status as FundTxStatus,
    thirdPartyNo: row.thirdPartyNo ?? null,
    runnerId: row.runnerId ?? null,
    adminId: row.adminId ?? null,
    remark: row.remark ?? null,
    operatorName: null,
    createdAt: row.createdAt.toISOString(),
  };
}

@Injectable()
export class FundTransactionsService {
  constructor(@Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase) {}

  async createRecord(data: CreateFundTxDto): Promise<void> {
    await this.db.insert(fundTransactions).values({
      orderId: data.orderId ?? null,
      txType: data.txType,
      amountFen: data.amountFen,
      direction: data.direction,
      channel: data.channel,
      status: data.status,
      runnerId: data.runnerId ?? null,
      adminId: data.adminId ?? null,
      remark: data.remark ?? null,
    });
  }

  async list(params: {
    page: number;
    pageSize: number;
    txType?: string;
    status?: string;
  }): Promise<{ items: FundTransaction[]; total: number }> {
    const { page, pageSize, txType, status } = params;
    const conditions = [];
    if (txType) conditions.push(eq(fundTransactions.txType, txType));
    if (status) conditions.push(eq(fundTransactions.status, status));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalResult, rows] = await Promise.all([
      this.db
        .select({ count: count() })
        .from(fundTransactions)
        .where(whereClause),
      this.db
        .select()
        .from(fundTransactions)
        .where(whereClause)
        .orderBy(desc(fundTransactions.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
    ]);

    const total = totalResult[0]?.count ?? 0;
    const items: FundTransaction[] = rows.map((row) => mapFundTx(row));

    return { items, total };
  }

  async updateStatus(id: string, status: FundTxStatus, remark?: string): Promise<void> {
    const updateData: Partial<typeof fundTransactions.$inferInsert> = { status };
    if (remark !== undefined) updateData.remark = remark;

    const updated = await this.db
      .update(fundTransactions)
      .set(updateData)
      .where(eq(fundTransactions.id, id))
      .returning({ id: fundTransactions.id });

    if (updated.length === 0) {
      throw new NotFoundException('资金流水不存在');
    }
  }

  async getStatsByStatus(status: FundTxStatus): Promise<{ count: number; totalFen: number }> {
    const result = await this.db
      .select({
        count: count(),
        totalFen: sql<number>`COALESCE(SUM(${fundTransactions.amountFen}), 0)`,
      })
      .from(fundTransactions)
      .where(eq(fundTransactions.status, status));

    const row = result[0];
    return {
      count: row?.count ?? 0,
      totalFen: Number(row?.totalFen ?? 0),
    };
  }
}
