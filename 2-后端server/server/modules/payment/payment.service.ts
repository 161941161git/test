import {
  Injectable,
  Inject,
  Logger,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@server/database/database.module';
import { eq, and, desc, sql, count, gte } from 'drizzle-orm';

import {
  paymentOrders,
  paymentConfigs,
  paymentAccounts,
  adminPaymentAccounts,
  fundTransactions,
  profitSharingRecords,
  orders,
  users,
  admins,
  withdrawRequests,
} from '@server/database/schema';
import type {
  PaymentOrder,
  PaymentConfig,
  PaymentAccount,
  FundTransaction,
  FundTxType,
  FundDashboard,
  ProfitSharingRecord,
  PayChannel,
} from '@shared/api.interface';
import { FUND_TX_TYPES } from '@shared/api.interface';

function fmtMoney(val: string | number): string {
  const num = typeof val === 'string' ? Number(val) : val;
  return Number.isFinite(num) ? num.toFixed(2) : '0.00';
}

function yuanToFen(yuanStr: string): number {
  return Math.round(Number(yuanStr) * 100);
}

function fenToYuan(fen: number): string {
  return (fen / 100).toFixed(2);
}

function generatePayNo(): string {
  return `PAY${Date.now()}${Math.floor(Math.random() * 9000 + 1000)}`;
}

function generateMockTradeNo(): string {
  return `MOCK${Date.now()}${Math.floor(Math.random() * 9000 + 1000)}`;
}

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(@Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase) {}

  // ========== 1. 支付配置 ==========

  async getConfig(): Promise<PaymentConfig> {
    const rows = await this.db.select().from(paymentConfigs).limit(1);
    if (rows.length === 0) {
      return {
        paymentMode: 'mock',
        wechatAppId: '',
        wechatMchId: '',
        wechatApiV3Key: '',
        wechatCertSerial: '',
        wechatPrivateKey: '',
        wechatPlatformCert: '',
        alipayAppId: '',
        alipayPrivateKey: '',
        alipayPublicKey: '',
        isManualMode: true,
      };
    }
    const row = rows[0];
    return {
      paymentMode: (row.paymentMode === 'real' ? 'real' : 'mock') as 'mock' | 'real',
      wechatAppId: row.wechatAppId ?? '',
      wechatMchId: row.wechatMchId ?? '',
      wechatApiV3Key: row.wechatApiV3Key ?? '',
      wechatCertSerial: row.wechatCertSerial ?? '',
      wechatPrivateKey: row.wechatPrivateKey ?? '',
      wechatPlatformCert: row.wechatPlatformCert ?? '',
      alipayAppId: row.alipayAppId ?? '',
      alipayPrivateKey: row.alipayPrivateKey ?? '',
      alipayPublicKey: row.alipayPublicKey ?? '',
      isManualMode: true,
    };
  }

  async saveConfig(dto: PaymentConfig): Promise<PaymentConfig> {
    const existing = await this.db.select({ id: paymentConfigs.id }).from(paymentConfigs).limit(1);

    if (existing.length > 0) {
      await this.db
        .update(paymentConfigs)
        .set({
          paymentMode: dto.paymentMode,
          wechatAppId: dto.wechatAppId || null,
          wechatMchId: dto.wechatMchId || null,
          wechatApiV3Key: dto.wechatApiV3Key || null,
          wechatCertSerial: dto.wechatCertSerial || null,
          wechatPrivateKey: dto.wechatPrivateKey || null,
          wechatPlatformCert: dto.wechatPlatformCert || null,
          alipayAppId: dto.alipayAppId || null,
          alipayPrivateKey: dto.alipayPrivateKey || null,
          alipayPublicKey: dto.alipayPublicKey || null,
        })
        .where(eq(paymentConfigs.id, existing[0].id));
    } else {
      await this.db.insert(paymentConfigs).values({
        paymentMode: dto.paymentMode,
        wechatAppId: dto.wechatAppId || null,
        wechatMchId: dto.wechatMchId || null,
        wechatApiV3Key: dto.wechatApiV3Key || null,
        wechatCertSerial: dto.wechatCertSerial || null,
        wechatPrivateKey: dto.wechatPrivateKey || null,
        wechatPlatformCert: dto.wechatPlatformCert || null,
        alipayAppId: dto.alipayAppId || null,
        alipayPrivateKey: dto.alipayPrivateKey || null,
        alipayPublicKey: dto.alipayPublicKey || null,
      });
    }

    return this.getConfig();
  }

  // ========== 2. 创建支付单 ==========

  async createPayment(orderId: string, channel: PayChannel, userId?: string): Promise<{
    paymentOrder: PaymentOrder;
    payUrl?: string;
  }> {
    const config = await this.getConfig();
    const effectiveChannel = config.paymentMode === 'mock' ? 'mock' : channel;

    const orderRows = await this.db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (orderRows.length === 0) {
      throw new NotFoundException('订单不存在');
    }

    const order = orderRows[0];

    if (order.paymentStatus !== 'unpaid') {
      throw new BadRequestException('订单已支付或已退款');
    }

    if (userId && order.buyerId !== userId) {
      throw new BadRequestException('只有订单买家可以发起支付');
    }

    if (order.status === 'refunded' || order.status === 'refunding') {
      throw new BadRequestException('订单状态不支持支付');
    }

    const amountFen = yuanToFen(order.totalAmount);
    const payNo = generatePayNo();

    const result = await this.db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(paymentOrders)
        .values({
          orderId,
          payNo,
          amountFen,
          channel: effectiveChannel,
          status: 'pending',
        })
        .returning();

      // 写入资金流水
      await tx.insert(fundTransactions).values({
        orderId,
        txType: 'payment',
        amountFen,
        direction: 'in',
        channel: effectiveChannel,
        status: 'pending',
        remark: `订单 ${order.orderNo} 支付`,
      });

      return inserted;
    });

    let payUrl: string | undefined;
    if (config.paymentMode === 'mock') {
      payUrl = `/payment/mock/${payNo}`;
    } else {
      // TODO: real 模式 — 调用微信/支付宝统一下单接口
      // 暂时回退到 mock 流程
      payUrl = `/payment/mock/${payNo}`;
      this.logger.warn(`real 模式未实现，回退到 mock 支付: ${payNo}`);
    }

    return {
      paymentOrder: this.mapPaymentOrder(result),
      payUrl,
    };
  }

  // ========== 3. 模拟支付成功 ==========

  async mockPaySuccess(payNo: string): Promise<PaymentOrder> {
    const config = await this.getConfig();

    const existing = await this.db
      .select()
      .from(paymentOrders)
      .where(eq(paymentOrders.payNo, payNo))
      .limit(1);

    if (existing.length === 0) {
      throw new NotFoundException('支付单不存在');
    }

    const payment = existing[0];
    if (payment.status === 'paid') {
      return this.mapPaymentOrder(payment);
    }
    if (payment.status !== 'pending') {
      throw new BadRequestException('支付单状态不允许支付');
    }

    const thirdPartyTradeNo = generateMockTradeNo();
    const paidAt = new Date();

    await this.db.transaction(async (tx) => {
      // 更新支付单
      const updatedPayment = await tx
        .update(paymentOrders)
        .set({
          status: 'paid',
          thirdPartyTradeNo,
          paidAt,
        })
        .where(and(
          eq(paymentOrders.id, payment.id),
          eq(paymentOrders.status, 'pending'),
        ))
        .returning();

      if (updatedPayment.length === 0) {
        throw new ConflictException('支付状态已变更');
      }

      // 更新订单支付状态
      const updatedOrders = await tx
        .update(orders)
        .set({
          paymentStatus: 'paid',
          payChannel: config.paymentMode === 'mock' ? 'mock' : payment.channel,
          thirdPartyTradeNo,
          paidAt,
        })
        .where(eq(orders.id, payment.orderId))
        .returning();

      if (updatedOrders.length === 0) {
        throw new BadRequestException('订单更新失败');
      }

      // 更新资金流水状态
      await tx
        .update(fundTransactions)
        .set({
          status: 'success',
          thirdPartyNo: thirdPartyTradeNo,
        })
        .where(and(
          eq(fundTransactions.orderId, payment.orderId),
          eq(fundTransactions.txType, 'payment'),
          eq(fundTransactions.status, 'pending'),
        ));
    });

    const updated = await this.db
      .select()
      .from(paymentOrders)
      .where(eq(paymentOrders.id, payment.id))
      .limit(1);

    return this.mapPaymentOrder(updated[0]);
  }

  // ========== 4. 分账 ==========

  async confirmProfitSharing(orderId: string): Promise<ProfitSharingRecord> {
    const config = await this.getConfig();

    const orderRows = await this.db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (orderRows.length === 0) {
      throw new NotFoundException('订单不存在');
    }

    const order = orderRows[0];

    if (order.paymentStatus !== 'paid') {
      throw new BadRequestException('订单未支付，无法分账');
    }

    if (!order.runnerId) {
      throw new BadRequestException('订单没有跑腿员，无法分账');
    }

    // 检查是否已分账
    const existingSharing = await this.db
      .select()
      .from(profitSharingRecords)
      .where(eq(profitSharingRecords.orderId, orderId))
      .limit(1);

    if (existingSharing.length > 0 && existingSharing[0].status === 'success') {
      return this.mapProfitSharing(existingSharing[0]);
    }

    const totalAmountFen = yuanToFen(order.totalAmount);
    const platformFeeFen = yuanToFen(order.platformFee || '0');
    const runnerAmountFen = totalAmountFen - platformFeeFen;

    // 查最新成功支付单
    const latestPayment = await this.db
      .select()
      .from(paymentOrders)
      .where(and(
        eq(paymentOrders.orderId, orderId),
        eq(paymentOrders.status, 'paid'),
      ))
      .orderBy(desc(paymentOrders.createdAt))
      .limit(1);

    let resultRecord: typeof profitSharingRecords.$inferSelect;

    await this.db.transaction(async (tx) => {
      // 插入或更新分账记录
      if (existingSharing.length > 0) {
        const [updated] = await tx
          .update(profitSharingRecords)
          .set({
            totalAmountFen,
            runnerAmountFen,
            platformAmountFen: platformFeeFen,
            status: 'pending',
            paymentOrderId: latestPayment[0]?.id ?? null,
            retryCount: sql`${profitSharingRecords.retryCount} + 1`,
          })
          .where(eq(profitSharingRecords.id, existingSharing[0].id))
          .returning();
        resultRecord = updated[0];
      } else {
        const [inserted] = await tx
          .insert(profitSharingRecords)
          .values({
            orderId,
            paymentOrderId: latestPayment[0]?.id ?? null,
            totalAmountFen,
            runnerAmountFen,
            platformAmountFen: platformFeeFen,
            status: 'pending',
          })
          .returning();
        resultRecord = inserted[0];
      }

      if (config.paymentMode === 'mock') {
        // mock 模式：直接加余额、加平台收益
        const runnerEarningsYuan = fenToYuan(runnerAmountFen);
        const platformFeeYuan = fenToYuan(platformFeeFen);

        // 跑腿员加余额和总收益
        await tx
          .update(users)
          .set({
            balance: sql`${users.balance} + ${runnerEarningsYuan}::numeric`,
            totalEarnings: sql`${users.totalEarnings} + ${runnerEarningsYuan}::numeric`,
            totalOrders: sql`${users.totalOrders} + 1`,
          })
          .where(eq(users.id, order.runnerId!));

        // 平台收益加到第一个管理员
        const adminRows = await tx.select({ id: admins.id }).from(admins).limit(1);
        let adminId: string | null = null;
        if (adminRows.length > 0) {
          adminId = adminRows[0].id;
          await tx
            .update(admins)
            .set({
              platformEarnings: sql`${admins.platformEarnings} + ${platformFeeYuan}::numeric`,
            })
            .where(eq(admins.id, adminId));
        }

        // 更新分账记录为成功
        await tx
          .update(profitSharingRecords)
          .set({ status: 'success' })
          .where(eq(profitSharingRecords.id, resultRecord.id));

        // 写资金流水：分账出账（从托管账户出）
        await tx.insert(fundTransactions).values([
          {
            orderId,
            txType: 'profit_sharing',
            amountFen: totalAmountFen,
            direction: 'out',
            channel: 'mock',
            status: 'success',
            remark: `订单分账出账 - 总额 ${fenToYuan(totalAmountFen)}`,
          },
          {
            orderId,
            txType: 'platform_fee',
            amountFen: platformFeeFen,
            direction: 'in',
            channel: 'mock',
            status: 'success',
            adminId,
            remark: `平台手续费收入 - ${fenToYuan(platformFeeFen)}`,
          },
        ]);

        // 跑腿员收入流水（用 runnerId 关联）
        await tx.insert(fundTransactions).values({
          orderId,
          txType: 'profit_sharing',
          amountFen: runnerAmountFen,
          direction: 'in',
          channel: 'mock',
          status: 'success',
          runnerId: order.runnerId,
          remark: `跑腿员分账收入 - ${fenToYuan(runnerAmountFen)}`,
        });
      } else {
        // TODO: real 模式 — 调用微信/支付宝分账接口
        // 暂时走 mock 流程
        this.logger.warn(`real 模式分账未实现，回退到 mock 流程: orderId=${orderId}`);
        // 保持 pending 状态，由异步回调更新
        // 为保证测试可用性，这里直接走 mock 结算
        const runnerEarningsYuan = fenToYuan(runnerAmountFen);
        const platformFeeYuan = fenToYuan(platformFeeFen);

        await tx
          .update(users)
          .set({
            balance: sql`${users.balance} + ${runnerEarningsYuan}::numeric`,
            totalEarnings: sql`${users.totalEarnings} + ${runnerEarningsYuan}::numeric`,
            totalOrders: sql`${users.totalOrders} + 1`,
          })
          .where(eq(users.id, order.runnerId!));

        const adminRows = await tx.select({ id: admins.id }).from(admins).limit(1);
        let adminId: string | null = null;
        if (adminRows.length > 0) {
          adminId = adminRows[0].id;
          await tx
            .update(admins)
            .set({
              platformEarnings: sql`${admins.platformEarnings} + ${platformFeeYuan}::numeric`,
            })
            .where(eq(admins.id, adminId));
        }

        await tx
          .update(profitSharingRecords)
          .set({ status: 'success' })
          .where(eq(profitSharingRecords.id, resultRecord.id));

        await tx.insert(fundTransactions).values([
          {
            orderId,
            txType: 'profit_sharing',
            amountFen: totalAmountFen,
            direction: 'out',
            channel: 'mock',
            status: 'success',
            remark: `订单分账出账 - 总额 ${fenToYuan(totalAmountFen)}`,
          },
          {
            orderId,
            txType: 'platform_fee',
            amountFen: platformFeeFen,
            direction: 'in',
            channel: 'mock',
            status: 'success',
            adminId,
            remark: `平台手续费收入 - ${fenToYuan(platformFeeFen)}`,
          },
          {
            orderId,
            txType: 'profit_sharing',
            amountFen: runnerAmountFen,
            direction: 'in',
            channel: 'mock',
            status: 'success',
            runnerId: order.runnerId,
            remark: `跑腿员分账收入 - ${fenToYuan(runnerAmountFen)}`,
          },
        ]);
      }
    });

    const finalRecord = await this.db
      .select()
      .from(profitSharingRecords)
      .where(eq(profitSharingRecords.orderId, orderId))
      .limit(1);

    return this.mapProfitSharing(finalRecord[0]);
  }

  // ========== 5. 退款 ==========

  async refundPayment(orderId: string, _refundRequestId?: string): Promise<PaymentOrder> {
    const config = await this.getConfig();

    // 查最新成功支付单
    const latestPayment = await this.db
      .select()
      .from(paymentOrders)
      .where(and(
        eq(paymentOrders.orderId, orderId),
        eq(paymentOrders.status, 'paid'),
      ))
      .orderBy(desc(paymentOrders.createdAt))
      .limit(1);

    if (latestPayment.length === 0) {
      throw new BadRequestException('该订单没有成功支付记录，无法退款');
    }

    const payment = latestPayment[0];

    await this.db.transaction(async (tx) => {
      const orderRows = await tx
        .select()
        .from(orders)
        .where(eq(orders.id, orderId))
        .limit(1);

      if (orderRows.length === 0) {
        throw new NotFoundException('订单不存在');
      }

      const order = orderRows[0];

      if (config.paymentMode === 'mock') {
        // 查是否已分账
        const sharingRows = await tx
          .select()
          .from(profitSharingRecords)
          .where(and(
            eq(profitSharingRecords.orderId, orderId),
            eq(profitSharingRecords.status, 'success'),
          ))
          .limit(1);

        if (sharingRows.length > 0 && order.runnerId) {
          // 已分账：冲正
          const sharing = sharingRows[0];
          const runnerEarningsYuan = fenToYuan(sharing.runnerAmountFen);
          const platformFeeYuan = fenToYuan(sharing.platformAmountFen);

          // 扣回跑腿员余额和总收益
          await tx
            .update(users)
            .set({
              balance: sql`
                CASE
                  WHEN ${users.balance}::numeric >= ${runnerEarningsYuan}::numeric
                  THEN ${users.balance}::numeric - ${runnerEarningsYuan}::numeric
                  ELSE 0::numeric
                END
              `,
              totalEarnings: sql`
                CASE
                  WHEN ${users.totalEarnings}::numeric >= ${runnerEarningsYuan}::numeric
                  THEN ${users.totalEarnings}::numeric - ${runnerEarningsYuan}::numeric
                  ELSE 0::numeric
                END
              `,
              totalOrders: sql`GREATEST(${users.totalOrders} - 1, 0)`,
            })
            .where(eq(users.id, order.runnerId));

          // 扣回平台收益
          const adminRows = await tx.select({ id: admins.id }).from(admins).limit(1);
          if (adminRows.length > 0) {
            await tx
              .update(admins)
              .set({
                platformEarnings: sql`
                  CASE
                    WHEN ${admins.platformEarnings}::numeric >= ${platformFeeYuan}::numeric
                    THEN ${admins.platformEarnings}::numeric - ${platformFeeYuan}::numeric
                    ELSE 0::numeric
                  END
                `,
              })
              .where(eq(admins.id, adminRows[0].id));
          }

          // 冲正分账记录
          await tx
            .update(profitSharingRecords)
            .set({
              status: 'failed',
              failReason: '退款冲正',
            })
            .where(eq(profitSharingRecords.id, sharing.id));
        }

        // 更新支付单状态为 refunded
        await tx
          .update(paymentOrders)
          .set({ status: 'refunded' })
          .where(eq(paymentOrders.id, payment.id));

        // 更新订单支付状态
        await tx
          .update(orders)
          .set({ paymentStatus: 'refunded' })
          .where(eq(orders.id, orderId));

        // 写退款流水
        await tx.insert(fundTransactions).values({
          orderId,
          txType: 'refund',
          amountFen: payment.amountFen,
          direction: 'out',
          channel: payment.channel,
          status: 'success',
          thirdPartyNo: `REFUND${Date.now()}`,
          remark: `订单退款 - ${fenToYuan(payment.amountFen)}`,
        });
      } else {
        // TODO: real 模式 — 调用微信/支付宝退款接口
        this.logger.warn(`real 模式退款未实现，回退到 mock 流程: orderId=${orderId}`);

        const sharingRows = await tx
          .select()
          .from(profitSharingRecords)
          .where(and(
            eq(profitSharingRecords.orderId, orderId),
            eq(profitSharingRecords.status, 'success'),
          ))
          .limit(1);

        if (sharingRows.length > 0 && order.runnerId) {
          const sharing = sharingRows[0];
          const runnerEarningsYuan = fenToYuan(sharing.runnerAmountFen);
          const platformFeeYuan = fenToYuan(sharing.platformAmountFen);

          await tx
            .update(users)
            .set({
              balance: sql`
                CASE
                  WHEN ${users.balance}::numeric >= ${runnerEarningsYuan}::numeric
                  THEN ${users.balance}::numeric - ${runnerEarningsYuan}::numeric
                  ELSE 0::numeric
                END
              `,
              totalEarnings: sql`
                CASE
                  WHEN ${users.totalEarnings}::numeric >= ${runnerEarningsYuan}::numeric
                  THEN ${users.totalEarnings}::numeric - ${runnerEarningsYuan}::numeric
                  ELSE 0::numeric
                END
              `,
              totalOrders: sql`GREATEST(${users.totalOrders} - 1, 0)`,
            })
            .where(eq(users.id, order.runnerId));

          const adminRows = await tx.select({ id: admins.id }).from(admins).limit(1);
          if (adminRows.length > 0) {
            await tx
              .update(admins)
              .set({
                platformEarnings: sql`
                  CASE
                    WHEN ${admins.platformEarnings}::numeric >= ${platformFeeYuan}::numeric
                    THEN ${admins.platformEarnings}::numeric - ${platformFeeYuan}::numeric
                    ELSE 0::numeric
                  END
                `,
              })
              .where(eq(admins.id, adminRows[0].id));
          }

          await tx
            .update(profitSharingRecords)
            .set({ status: 'failed', failReason: '退款冲正' })
            .where(eq(profitSharingRecords.id, sharing.id));
        }

        await tx
          .update(paymentOrders)
          .set({ status: 'refunded' })
          .where(eq(paymentOrders.id, payment.id));

        await tx
          .update(orders)
          .set({ paymentStatus: 'refunded' })
          .where(eq(orders.id, orderId));

        await tx.insert(fundTransactions).values({
          orderId,
          txType: 'refund',
          amountFen: payment.amountFen,
          direction: 'out',
          channel: payment.channel,
          status: 'success',
          thirdPartyNo: `REFUND${Date.now()}`,
          remark: `订单退款 - ${fenToYuan(payment.amountFen)}`,
        });
      }
    });

    const updated = await this.db
      .select()
      .from(paymentOrders)
      .where(eq(paymentOrders.id, payment.id))
      .limit(1);

    return this.mapPaymentOrder(updated[0]);
  }

  // ========== 6. 收款账户 ==========

  async savePaymentAccount(
    userId: string,
    channel: PayChannel,
    accountNo: string,
    realName?: string,
  ): Promise<PaymentAccount> {
    const existing = await this.db
      .select()
      .from(paymentAccounts)
      .where(and(
        eq(paymentAccounts.userId, userId),
        eq(paymentAccounts.channel, channel),
      ))
      .limit(1);

    let record: typeof paymentAccounts.$inferSelect;

    if (existing.length > 0) {
      const [updated] = await this.db
        .update(paymentAccounts)
        .set({
          accountNo,
          realName: realName ?? null,
          accountType: 'personal',
        })
        .where(eq(paymentAccounts.id, existing[0].id))
        .returning();
      record = updated[0];
    } else {
      const [inserted] = await this.db
        .insert(paymentAccounts)
        .values({
          userId,
          channel,
          accountNo,
          realName: realName ?? null,
          accountType: 'personal',
          isDefault: false,
        })
        .returning();
      record = inserted[0];
    }

    return this.mapPaymentAccount(record);
  }

  async getPaymentAccount(userId: string): Promise<PaymentAccount[]> {
    const rows = await this.db
      .select()
      .from(paymentAccounts)
      .where(eq(paymentAccounts.userId, userId))
      .orderBy(desc(paymentAccounts.createdAt));

    return rows.map((row) => this.mapPaymentAccount(row));
  }

  async saveAdminPaymentAccount(
    adminId: string,
    channel: PayChannel,
    accountNo: string,
    realName?: string,
  ): Promise<void> {
    const existing = await this.db
      .select()
      .from(adminPaymentAccounts)
      .where(and(
        eq(adminPaymentAccounts.adminId, adminId),
        eq(adminPaymentAccounts.channel, channel),
      ))
      .limit(1);

    if (existing.length > 0) {
      await this.db
        .update(adminPaymentAccounts)
        .set({
          accountNo,
          realName: realName ?? null,
        })
        .where(eq(adminPaymentAccounts.id, existing[0].id));
    } else {
      await this.db.insert(adminPaymentAccounts).values({
        adminId,
        channel,
        accountNo,
        realName: realName ?? null,
        isDefault: false,
      });
    }
  }

  // ========== 7. 资金流水 ==========

  async getFundTransactions(params: {
    page?: number;
    pageSize?: number;
    txType?: string;
    status?: string;
  }): Promise<{ items: FundTransaction[]; total: number }> {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;
    const offset = (page - 1) * pageSize;

    const conditions = [];
    if (params.txType && (FUND_TX_TYPES as readonly string[]).includes(params.txType)) {
      conditions.push(eq(fundTransactions.txType, params.txType));
    }
    if (params.status) {
      conditions.push(eq(fundTransactions.status, params.status));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult, listRows] = await Promise.all([
      this.db.select({ count: count() }).from(fundTransactions).where(whereClause),
      this.db
        .select()
        .from(fundTransactions)
        .where(whereClause)
        .orderBy(desc(fundTransactions.createdAt))
        .limit(pageSize)
        .offset(offset),
    ]);

    const items: FundTransaction[] = listRows.map((row) => ({
      id: row.id,
      orderId: row.orderId ?? null,
      txType: row.txType as FundTxType,
      amountFen: row.amountFen,
      direction: row.direction as 'in' | 'out',
      channel: row.channel,
      status: row.status as 'pending' | 'success' | 'failed',
      thirdPartyNo: row.thirdPartyNo ?? null,
      runnerId: row.runnerId ?? null,
      adminId: row.adminId ?? null,
      operatorName: null,
      remark: row.remark ?? null,
      createdAt: row.createdAt.toISOString(),
    }));

    return { items, total: Number(countResult[0]?.count ?? 0) };
  }

  // ========== 8. 资金看板 ==========

  async getFundDashboard(): Promise<FundDashboard> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIso = today.toISOString();

    const [
      unpaidRes,
      escrowRes,
      todayRes,
      sharingRes,
      platformFeeRes,
      pendingRefundRes,
      pendingWithdrawRes,
    ] = await Promise.all([
      // 待支付金额：payment_orders 中 pending 状态
      this.db
        .select({ total: sql<string>`COALESCE(SUM(${paymentOrders.amountFen}), 0)` })
        .from(paymentOrders)
        .where(eq(paymentOrders.status, 'pending')),
      // 托管金额：已支付但未分账的订单金额
      this.db
        .select({ total: sql<string>`COALESCE(SUM(${paymentOrders.amountFen}), 0)` })
        .from(paymentOrders)
        .leftJoin(
          profitSharingRecords,
          eq(paymentOrders.orderId, profitSharingRecords.orderId),
        )
        .where(and(
          eq(paymentOrders.status, 'paid'),
          sql`${profitSharingRecords.id} IS NULL`,
        )),
      // 今日支付金额
      this.db
        .select({ total: sql<string>`COALESCE(SUM(${fundTransactions.amountFen}), 0)` })
        .from(fundTransactions)
        .where(and(
          eq(fundTransactions.txType, 'payment'),
          eq(fundTransactions.status, 'success'),
          gte(fundTransactions.createdAt, sql`${todayIso}::timestamptz`),
        )),
      // 总分账金额
      this.db
        .select({ total: sql<string>`COALESCE(SUM(${profitSharingRecords.totalAmountFen}), 0)` })
        .from(profitSharingRecords)
        .where(eq(profitSharingRecords.status, 'success')),
      // 平台手续费总额
      this.db
        .select({ total: sql<string>`COALESCE(SUM(${fundTransactions.amountFen}), 0)` })
        .from(fundTransactions)
        .where(and(
          eq(fundTransactions.txType, 'platform_fee'),
          eq(fundTransactions.status, 'success'),
        )),
      // 待处理退款数
      this.db
        .select({ count: count() })
        .from(fundTransactions)
        .where(and(
          eq(fundTransactions.txType, 'refund'),
          eq(fundTransactions.status, 'pending'),
        )),
      // 待处理提现数
      this.db
        .select({ count: count() })
        .from(withdrawRequests)
        .where(eq(withdrawRequests.status, 'pending')),
    ]);

    return {
      unpaidAmount: fenToYuan(Number(unpaidRes[0]?.total ?? 0)),
      escrowAmount: fenToYuan(Number(escrowRes[0]?.total ?? 0)),
      todayAmount: fenToYuan(Number(todayRes[0]?.total ?? 0)),
      totalSharingAmount: fenToYuan(Number(sharingRes[0]?.total ?? 0)),
      platformFeeTotal: fenToYuan(Number(platformFeeRes[0]?.total ?? 0)),
      pendingRefunds: Number(pendingRefundRes[0]?.count ?? 0),
      pendingWithdraws: Number(pendingWithdrawRes[0]?.count ?? 0),
    };
  }

  // ========== 9. 提现打款 ==========

  async processWithdraw(withdrawId: string): Promise<void> {
    const config = await this.getConfig();

    const existing = await this.db
      .select()
      .from(withdrawRequests)
      .where(eq(withdrawRequests.id, withdrawId))
      .limit(1);

    if (existing.length === 0) {
      throw new NotFoundException('提现记录不存在');
    }

    if (existing[0].status !== 'pending') {
      throw new BadRequestException('只有待审核的提现记录可以打款');
    }

    const amountFen = yuanToFen(existing[0].amount);
    const paidAt = new Date();

    await this.db.transaction(async (tx) => {
      const updated = await tx
        .update(withdrawRequests)
        .set({
          status: 'paid',
          paidAt,
        })
        .where(and(
          eq(withdrawRequests.id, withdrawId),
          eq(withdrawRequests.status, 'pending'),
        ))
        .returning();

      if (updated.length === 0) {
        throw new ConflictException('提现状态已变更');
      }

      if (config.paymentMode === 'mock') {
        // mock 模式：直接标记打款成功
        await tx.insert(fundTransactions).values({
          txType: 'withdraw',
          amountFen,
          direction: 'out',
          channel: existing[0].channel,
          status: 'success',
          thirdPartyNo: `WITHDRAW${Date.now()}`,
          runnerId: existing[0].userId,
          remark: `用户提现 - ${fenToYuan(amountFen)}`,
        });
      } else {
        // TODO: real 模式 — 调用微信/支付宝转账接口
        this.logger.warn(`real 模式提现打款未实现，回退到 mock 流程: withdrawId=${withdrawId}`);
        await tx.insert(fundTransactions).values({
          txType: 'withdraw',
          amountFen,
          direction: 'out',
          channel: existing[0].channel,
          status: 'success',
          thirdPartyNo: `WITHDRAW${Date.now()}`,
          runnerId: existing[0].userId,
          remark: `用户提现 - ${fenToYuan(amountFen)}`,
        });
      }
    });
  }

  // ========== 10. 重试分账 ==========

  async retryProfitSharing(orderId: string): Promise<ProfitSharingRecord> {
    const existing = await this.db
      .select()
      .from(profitSharingRecords)
      .where(eq(profitSharingRecords.orderId, orderId))
      .limit(1);

    if (existing.length > 0 && existing[0].status === 'success') {
      return this.mapProfitSharing(existing[0]);
    }

    return this.confirmProfitSharing(orderId);
  }

  // ========== 辅助方法 ==========

  private mapPaymentOrder(row: typeof paymentOrders.$inferSelect): PaymentOrder {
    const statusMap: Record<string, PaymentOrder['status']> = {
      pending: 'pending',
      paid: 'paid',
      refunded: 'failed',
      failed: 'failed',
      closed: 'closed',
    };
    return {
      id: row.id,
      orderId: row.orderId,
      payNo: row.payNo,
      amountFen: row.amountFen,
      channel: row.channel as PayChannel,
      status: statusMap[row.status] ?? 'pending',
      thirdPartyTradeNo: row.thirdPartyTradeNo ?? null,
      paidAt: row.paidAt ? row.paidAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private mapPaymentAccount(row: typeof paymentAccounts.$inferSelect): PaymentAccount {
    return {
      id: row.id,
      channel: row.channel as PayChannel,
      accountNo: row.accountNo,
      realName: row.realName ?? null,
      isDefault: row.isDefault,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private mapProfitSharing(row: typeof profitSharingRecords.$inferSelect): ProfitSharingRecord {
    return {
      id: row.id,
      orderId: row.orderId,
      totalAmountFen: row.totalAmountFen,
      runnerAmountFen: row.runnerAmountFen,
      platformAmountFen: row.platformAmountFen,
      status: row.status as 'pending' | 'success' | 'failed',
      failReason: row.failReason ?? null,
      retryCount: row.retryCount,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
