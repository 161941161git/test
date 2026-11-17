import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@server/database/database.module';
import { eq, desc, and, ilike, count, sql } from 'drizzle-orm';

import { settlementSessions, settlementMessages, orders, users } from '@server/database/schema';
import { NotificationsService } from '@server/modules/notifications/notifications.service';
import type {
  SettlementSession,
  SettlementMessage,
  SettlementSessionStatus,
} from '@shared/api.interface';
import { MESSAGE_TYPES } from '@shared/api.interface';

function fenToYuan(fen: number): string {
  return (fen / 100).toFixed(2);
}

function yuanToFen(yuanStr: string): number {
  return Math.round(Number(yuanStr) * 100);
}

@Injectable()
export class SettlementService {
  private readonly logger = new Logger(SettlementService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
    private readonly notificationsService: NotificationsService,
  ) {}

  async createSession(orderId: string): Promise<string> {
    const orderRows = await this.db
      .select({
        id: orders.id,
        runnerId: orders.runnerId,
        totalAmount: orders.totalAmount,
        runnerEarnings: orders.runnerEarnings,
        platformFee: orders.platformFee,
      })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (orderRows.length === 0) throw new NotFoundException('订单不存在');
    const order = orderRows[0];
    if (!order.runnerId) throw new BadRequestException('订单尚未接单，无法创建结算会话');

    const totalFen = yuanToFen(String(order.totalAmount));
    let runnerFen = yuanToFen(String(order.runnerEarnings));
    let platformFen = yuanToFen(String(order.platformFee));
    if (runnerFen === 0 && totalFen > 0) {
      runnerFen = Math.round(totalFen * 0.9);
      platformFen = totalFen - runnerFen;
    }

    const existing = await this.db
      .select({ id: settlementSessions.id })
      .from(settlementSessions)
      .where(eq(settlementSessions.orderId, orderId))
      .limit(1);
    if (existing.length > 0) {
      return existing[0].id;
    }

    const inserted = await this.db
      .insert(settlementSessions)
      .values({
        orderId,
        runnerId: order.runnerId,
        totalAmountFen: totalFen,
        runnerAmountFen: runnerFen,
        platformFeeFen: platformFen,
        status: 'pending_payment',
      })
      .returning({ id: settlementSessions.id });

    const sessionId = inserted[0].id;

    // 查询跑腿员收款码
    const runnerRows = await this.db
      .select({
        wechatQrUrl: users.wechatQrUrl,
        alipayQrUrl: users.alipayQrUrl,
      })
      .from(users)
      .where(eq(users.id, order.runnerId))
      .limit(1);
    const runnerQr = runnerRows[0];

    const runnerAmountYuan = fenToYuan(runnerFen);
    const totalAmountYuan = fenToYuan(totalFen);
    await this.db.insert(settlementMessages).values({
      sessionId,
      senderRole: 'system',
      msgType: 'text',
      content: `本单跑腿费 ¥${totalAmountYuan}，扣 10% 平台手续费后可得 ¥${runnerAmountYuan}。请把你的微信/支付宝收款码发到这里，平台核对后转给你。`,
      imageUrl: '',
      isSystem: true,
    });

    // 自动插入跑腿员收款码图片消息（从兼职申请/档案回填的收款码），发送者=跑腿员
    if (runnerQr?.wechatQrUrl) {
      await this.db.insert(settlementMessages).values({
        sessionId,
        senderRole: 'runner',
        msgType: 'image',
        content: '跑腿员收款码',
        imageUrl: runnerQr.wechatQrUrl,
        isSystem: false,
      });
    }

    return sessionId;
  }

  async markOrderPaid(sessionId: string): Promise<void> {
    const sessionRows = await this.db
      .select({
        id: settlementSessions.id,
        status: settlementSessions.status,
        runnerAmountFen: settlementSessions.runnerAmountFen,
      })
      .from(settlementSessions)
      .where(eq(settlementSessions.id, sessionId))
      .limit(1);
    if (sessionRows.length === 0) throw new NotFoundException('结算会话不存在');
    const session = sessionRows[0];

    if (session.status === 'pending_settle' || session.status === 'paid') return;

    await this.db
      .update(settlementSessions)
      .set({ status: 'pending_settle' })
      .where(eq(settlementSessions.id, sessionId));

    const runnerAmountYuan = fenToYuan(session.runnerAmountFen);
    await this.db.insert(settlementMessages).values({
      sessionId,
      senderRole: 'system',
      msgType: 'text',
      content: `买家已确认收货。本单应付跑腿员 ¥${runnerAmountYuan}（已扣 10% 平台手续费），请在收到款后确认。`,
      imageUrl: '',
      isSystem: true,
    });
  }

  private async verifyRunnerAccess(sessionId: string, runnerId: string): Promise<void> {
    const sessionRows = await this.db
      .select({ sessionRunnerId: settlementSessions.runnerId })
      .from(settlementSessions)
      .where(eq(settlementSessions.id, sessionId))
      .limit(1);
    if (sessionRows.length === 0) throw new NotFoundException('结算会话不存在');
    if (sessionRows[0].sessionRunnerId !== runnerId) {
      throw new ForbiddenException('这是别人的结算单，无法查看');
    }
  }

  async getSessionAsRunner(id: string, runnerId: string): Promise<SettlementSession> {
    await this.verifyRunnerAccess(id, runnerId);
    return this.getSession(id);
  }

  async getMessagesAsRunner(sessionId: string, runnerId: string): Promise<SettlementMessage[]> {
    await this.verifyRunnerAccess(sessionId, runnerId);
    return this.getMessages(sessionId);
  }

  async getSession(id: string): Promise<SettlementSession> {
    const rows = await this.db
      .select({
        id: settlementSessions.id,
        orderId: settlementSessions.orderId,
        orderNo: orders.orderNo,
        runnerId: settlementSessions.runnerId,
        runnerName: users.name,
        runnerPhone: users.phone,
        wechatQrUrl: users.wechatQrUrl,
        totalAmountFen: settlementSessions.totalAmountFen,
        runnerAmountFen: settlementSessions.runnerAmountFen,
        platformFeeFen: settlementSessions.platformFeeFen,
        status: settlementSessions.status,
        paidAt: settlementSessions.paidAt,
        paidRemark: settlementSessions.paidRemark,
        payProofUrl: settlementSessions.payProofUrl,
        createdAt: settlementSessions.createdAt,
      })
      .from(settlementSessions)
      .innerJoin(orders, eq(settlementSessions.orderId, orders.id))
      .innerJoin(users, eq(settlementSessions.runnerId, users.id))
      .where(eq(settlementSessions.id, id))
      .limit(1);

    if (rows.length === 0) throw new NotFoundException('结算会话不存在');
    const row = rows[0];
    return {
      id: row.id,
      orderId: row.orderId,
      orderNo: row.orderNo,
      runnerId: row.runnerId,
      runnerName: row.runnerName ?? '',
      runnerPhone: row.runnerPhone ?? '',
      wechatQrUrl: row.wechatQrUrl ?? '',
      totalAmountFen: row.totalAmountFen,
      runnerAmountFen: row.runnerAmountFen,
      platformFeeFen: row.platformFeeFen,
      status: row.status as SettlementSessionStatus,
      paidAt: row.paidAt ? new Date(row.paidAt).toISOString() : null,
      paidRemark: row.paidRemark ?? null,
      payProofUrl: row.payProofUrl ?? null,
      createdAt: new Date(row.createdAt).toISOString(),
    };
  }

  async getMessages(sessionId: string): Promise<SettlementMessage[]> {
    const rows = await this.db
      .select()
      .from(settlementMessages)
      .where(eq(settlementMessages.sessionId, sessionId))
      .orderBy(settlementMessages.createdAt);

    return rows.map((row) => ({
      id: row.id,
      sessionId: row.sessionId,
      senderRole: row.senderRole as 'runner' | 'platform' | 'system',
      msgType: (MESSAGE_TYPES.includes(row.msgType as any) ? row.msgType : 'text') as 'text' | 'image',
      content: row.content,
      imageUrl: row.imageUrl,
      isSystem: row.isSystem,
      createdAt: new Date(row.createdAt).toISOString(),
    }));
  }

  async sendMessageAsRunner(
    sessionId: string,
    runnerId: string,
    msgType: 'text' | 'image',
    content: string,
    imageUrl: string,
  ): Promise<SettlementMessage> {
    await this.verifyRunnerAccess(sessionId, runnerId);
    return this.sendMessage(sessionId, 'runner', msgType, content, imageUrl);
  }

  async sendMessage(
    sessionId: string,
    senderRole: 'runner' | 'platform',
    msgType: 'text' | 'image',
    content: string,
    imageUrl: string,
  ): Promise<SettlementMessage> {
    if (msgType === 'text' && !content?.trim()) {
      throw new BadRequestException('消息内容不能为空');
    }
    if (msgType === 'image' && !imageUrl) {
      throw new BadRequestException('图片不能为空');
    }

    const sessionRows = await this.db
      .select({ id: settlementSessions.id })
      .from(settlementSessions)
      .where(eq(settlementSessions.id, sessionId))
      .limit(1);
    if (sessionRows.length === 0) throw new NotFoundException('结算会话不存在');

    const inserted = await this.db
      .insert(settlementMessages)
      .values({
        sessionId,
        senderRole,
        msgType,
        content: content ?? '',
        imageUrl: imageUrl ?? '',
        isSystem: false,
      })
      .returning();

    const row = inserted[0];
    return {
      id: row.id,
      sessionId: row.sessionId,
      senderRole: row.senderRole as 'runner' | 'platform' | 'system',
      msgType: row.msgType as 'text' | 'image',
      content: row.content,
      imageUrl: row.imageUrl,
      isSystem: row.isSystem,
      createdAt: new Date(row.createdAt).toISOString(),
    };
  }

  async markPaid(sessionId: string, remark: string, adminName: string): Promise<void> {
    const sessionRows = await this.db
      .select({
        id: settlementSessions.id,
        status: settlementSessions.status,
        runnerAmountFen: settlementSessions.runnerAmountFen,
        runnerId: settlementSessions.runnerId,
        orderId: settlementSessions.orderId,
      })
      .from(settlementSessions)
      .where(eq(settlementSessions.id, sessionId))
      .limit(1);
    if (sessionRows.length === 0) throw new NotFoundException('结算会话不存在');
    const session = sessionRows[0];

    if (session.status === 'paid') return;
    if (session.status !== 'pending_settle' && session.status !== 'pending_payment') {
      throw new BadRequestException('当前状态不可标记已打款');
    }

    const now = new Date();
    await this.db
      .update(settlementSessions)
      .set({
        status: 'paid',
        paidAt: now,
        paidRemark: remark ?? '',
      })
      .where(eq(settlementSessions.id, sessionId));

    const runnerAmountYuan = fenToYuan(session.runnerAmountFen);
    const timeStr = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    const sysContent = `平台已于 ${timeStr} 打款 ¥${runnerAmountYuan}，请注意查收。${remark ? `备注：${remark}` : ''}`;

    await this.db.insert(settlementMessages).values({
      sessionId,
      senderRole: 'system',
      msgType: 'text',
        content: sysContent,
        imageUrl: '',
        isSystem: true,
      });

    void this.notificationsService.send(
      'user',
      session.runnerId,
      '平台已打款',
      `平台已打款 ¥${runnerAmountYuan}，请注意查收`,
      'settlement',
      sessionId,
    );
  }

  async markRefunded(orderId: string): Promise<void> {
    const sessions = await this.db
      .select({ id: settlementSessions.id })
      .from(settlementSessions)
      .where(eq(settlementSessions.orderId, orderId));
    for (const s of sessions) {
      await this.db
        .update(settlementSessions)
        .set({ status: 'refunded' })
        .where(eq(settlementSessions.id, s.id));

      await this.db.insert(settlementMessages).values({
        sessionId: s.id,
        senderRole: 'system',
        msgType: 'text',
        content: '本单已退款，结算取消。',
        imageUrl: '',
        isSystem: true,
      });
    }
  }

  async listSessions(
    page: number,
    pageSize: number,
    status?: string,
    runnerName?: string,
  ): Promise<{ items: SettlementSession[]; total: number }> {
    const whereConditions = [];
    if (status) {
      whereConditions.push(eq(settlementSessions.status, status));
    }

    let baseQuery = this.db
      .select({
        id: settlementSessions.id,
        orderId: settlementSessions.orderId,
        orderNo: orders.orderNo,
        runnerId: settlementSessions.runnerId,
        runnerName: users.name,
        runnerPhone: users.phone,
        wechatQrUrl: users.wechatQrUrl,
        totalAmountFen: settlementSessions.totalAmountFen,
        runnerAmountFen: settlementSessions.runnerAmountFen,
        platformFeeFen: settlementSessions.platformFeeFen,
        status: settlementSessions.status,
        paidAt: settlementSessions.paidAt,
        paidRemark: settlementSessions.paidRemark,
        payProofUrl: settlementSessions.payProofUrl,
        createdAt: settlementSessions.createdAt,
      })
      .from(settlementSessions)
      .innerJoin(orders, eq(settlementSessions.orderId, orders.id))
      .innerJoin(users, eq(settlementSessions.runnerId, users.id))
      .$dynamic();

    if (runnerName) {
      baseQuery = baseQuery.where(ilike(users.name, `%${runnerName}%`));
    }
    if (whereConditions.length > 0) {
      baseQuery = baseQuery.where(and(...whereConditions));
    }

    const rows = await baseQuery
      .orderBy(desc(settlementSessions.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    const countQuery = this.db
      .select({ count: count() })
      .from(settlementSessions)
      .innerJoin(users, eq(settlementSessions.runnerId, users.id))
      .$dynamic();
    if (runnerName) {
      countQuery.where(ilike(users.name, `%${runnerName}%`));
    }
    if (whereConditions.length > 0) {
      countQuery.where(and(...whereConditions));
    }
    const totalRow = await countQuery;
    const total = Number(totalRow[0]?.count ?? 0);

    const items: SettlementSession[] = rows.map((row) => ({
      id: row.id,
      orderId: row.orderId,
      orderNo: row.orderNo,
      runnerId: row.runnerId,
      runnerName: row.runnerName ?? '',
      runnerPhone: row.runnerPhone ?? '',
      wechatQrUrl: (row as any).wechatQrUrl ?? '',
      totalAmountFen: row.totalAmountFen,
      runnerAmountFen: row.runnerAmountFen,
      platformFeeFen: row.platformFeeFen,
      status: row.status as SettlementSessionStatus,
      paidAt: row.paidAt ? new Date(row.paidAt).toISOString() : null,
      paidRemark: row.paidRemark ?? null,
      payProofUrl: row.payProofUrl ?? null,
      createdAt: new Date(row.createdAt).toISOString(),
    }));

    return { items, total: Number(totalRow[0]?.count ?? 0) };
  }

  async getRunnerSessions(runnerId: string): Promise<SettlementSession[]> {
    const rows = await this.db
      .select({
        id: settlementSessions.id,
        orderId: settlementSessions.orderId,
        orderNo: orders.orderNo,
        runnerId: settlementSessions.runnerId,
        runnerName: users.name,
        runnerPhone: users.phone,
        wechatQrUrl: users.wechatQrUrl,
        totalAmountFen: settlementSessions.totalAmountFen,
        runnerAmountFen: settlementSessions.runnerAmountFen,
        platformFeeFen: settlementSessions.platformFeeFen,
        status: settlementSessions.status,
        paidAt: settlementSessions.paidAt,
        paidRemark: settlementSessions.paidRemark,
        payProofUrl: settlementSessions.payProofUrl,
        createdAt: settlementSessions.createdAt,
      })
      .from(settlementSessions)
      .innerJoin(orders, eq(settlementSessions.orderId, orders.id))
      .innerJoin(users, eq(settlementSessions.runnerId, users.id))
      .where(eq(settlementSessions.runnerId, runnerId))
      .orderBy(desc(settlementSessions.createdAt));

    return rows.map((row) => ({
      id: row.id,
      orderId: row.orderId,
      orderNo: row.orderNo,
      runnerId: row.runnerId,
      runnerName: row.runnerName ?? '',
      runnerPhone: row.runnerPhone ?? '',
      wechatQrUrl: (row as any).wechatQrUrl ?? '',
      totalAmountFen: row.totalAmountFen,
      runnerAmountFen: row.runnerAmountFen,
      platformFeeFen: row.platformFeeFen,
      status: row.status as SettlementSessionStatus,
      paidAt: row.paidAt ? new Date(row.paidAt).toISOString() : null,
      paidRemark: row.paidRemark ?? null,
      payProofUrl: row.payProofUrl ?? null,
      createdAt: new Date(row.createdAt).toISOString(),
    }));
  }

  async getRunnerEarningsSummary(runnerId: string): Promise<{
    totalEarnings: string;
    pendingSettlement: string;
    settled: string;
    totalPlatformFee: string;
    availableWithdraw: string;
  }> {
    const rows = await this.db
      .select({
        status: settlementSessions.status,
        runnerAmountFen: settlementSessions.runnerAmountFen,
        platformFeeFen: settlementSessions.platformFeeFen,
      })
      .from(settlementSessions)
      .where(eq(settlementSessions.runnerId, runnerId));

    let totalEarningsFen = 0;
    let pendingSettlementFen = 0;
    let settledFen = 0;
    let totalPlatformFeeFen = 0;

    for (const row of rows) {
      totalEarningsFen += row.runnerAmountFen;
      totalPlatformFeeFen += row.platformFeeFen;
      if (row.status === 'paid') {
        settledFen += row.runnerAmountFen;
      } else if (row.status === 'pending_settle' || row.status === 'pending_payment') {
        pendingSettlementFen += row.runnerAmountFen;
      }
    }

    const userRows = await this.db
      .select({ totalEarnings: users.totalEarnings })
      .from(users)
      .where(eq(users.id, runnerId))
      .limit(1);
    const totalEarnings = userRows[0]?.totalEarnings
      ? String(userRows[0].totalEarnings)
      : fenToYuan(settledFen);

    return {
      totalEarnings,
      pendingSettlement: fenToYuan(pendingSettlementFen),
      settled: fenToYuan(settledFen),
      totalPlatformFee: fenToYuan(totalPlatformFeeFen),
      availableWithdraw: totalEarnings,
    };
  }
}
