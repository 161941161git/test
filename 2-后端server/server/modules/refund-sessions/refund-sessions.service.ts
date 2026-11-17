import {
  Injectable,
  Inject,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@server/database/database.module';
import { eq, and, desc, count, gte, lt, sql } from 'drizzle-orm';

import {
  refundSessions,
  refundMessages,
  orders,
  users,
  refundRequests,
  fundTransactions,
} from '@server/database/schema';
import { NotificationsService } from '../notifications/notifications.service';
import type {
  RefundSession,
  RefundMessage,
} from '@shared/api.interface';

@Injectable()
export class RefundSessionsService {
  private readonly logger = new Logger(RefundSessionsService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
    private readonly notificationsService: NotificationsService,
  ) {}

  // ========== 买家侧 ==========

  /** 根据订单号查买家的退款会话（不存在返回 null） */
  async getSessionByOrderId(orderId: string, buyerId: string): Promise<RefundSession | null> {
    const rows = await this.db
      .select()
      .from(refundSessions)
      .where(and(eq(refundSessions.orderId, orderId), eq(refundSessions.buyerId, buyerId)))
      .limit(1);

    if (rows.length === 0) return null;

    return this.buildSessionDto(rows[0]);
  }

  /** 会话消息列表（按时间正序） */
  async getMessages(sessionId: string, buyerId?: string): Promise<RefundMessage[]> {
    const sessionRows = await this.db
      .select()
      .from(refundSessions)
      .where(eq(refundSessions.id, sessionId))
      .limit(1);

    if (sessionRows.length === 0) {
      throw new NotFoundException('退款会话不存在');
    }

    if (buyerId && sessionRows[0].buyerId !== buyerId) {
      throw new ForbiddenException('无权查看该会话');
    }

    const msgRows = await this.db
      .select()
      .from(refundMessages)
      .where(eq(refundMessages.sessionId, sessionId))
      .orderBy(refundMessages.createdAt);

    return msgRows.map((m) => this.mapMessageDto(m));
  }

  /** 买家发消息 */
  async sendBuyerMessage(
    sessionId: string,
    buyerId: string,
    msgType: 'text' | 'image',
    content: string,
    imageUrl: string,
  ): Promise<RefundMessage> {
    const sessionRows = await this.db
      .select()
      .from(refundSessions)
      .where(eq(refundSessions.id, sessionId))
      .limit(1);

    if (sessionRows.length === 0) {
      throw new NotFoundException('退款会话不存在');
    }

    if (sessionRows[0].buyerId !== buyerId) {
      throw new ForbiddenException('无权操作该会话');
    }

    if (msgType === 'text' && !content.trim()) {
      throw new BadRequestException('消息内容不能为空');
    }

    const [inserted] = await this.db
      .insert(refundMessages)
      .values({
        sessionId,
        senderRole: 'buyer',
        senderId: buyerId,
        msgType,
        content: content ?? '',
        imageUrl: imageUrl ?? '',
        isSystem: false,
      })
      .returning();

    return this.mapMessageDto(inserted);
  }

  // ========== 后台（管理员） ==========

  /** 管理员退款会话列表（分页） */
  async getAdminList(
    page: number,
    pageSize: number,
    status?: string,
  ): Promise<{ items: RefundSession[]; total: number }> {
    const offset = (page - 1) * pageSize;

    const conditions = [];
    if (status) conditions.push(eq(refundSessions.status, status));
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countRes] = await this.db
      .select({ count: count() })
      .from(refundSessions)
      .where(whereClause);

    const sessionRows = await this.db
      .select()
      .from(refundSessions)
      .where(whereClause)
      .orderBy(desc(refundSessions.createdAt))
      .limit(pageSize)
      .offset(offset);

    if (sessionRows.length === 0) {
      return { items: [], total: Number(countRes.count ?? 0) };
    }

    const items = await Promise.all(
      sessionRows.map((s) => this.buildSessionDto(s)),
    );

    return { items, total: Number(countRes.count ?? 0) };
  }

  /** 会话详情（管理员） */
  async getAdminDetail(id: string): Promise<{
    session: RefundSession;
    messages: RefundMessage[];
    latestImage: string | null;
  }> {
    const rows = await this.db
      .select()
      .from(refundSessions)
      .where(eq(refundSessions.id, id))
      .limit(1);

    if (rows.length === 0) {
      throw new NotFoundException('退款会话不存在');
    }

    const session = await this.buildSessionDto(rows[0]);

    const msgRows = await this.db
      .select()
      .from(refundMessages)
      .where(eq(refundMessages.sessionId, id))
      .orderBy(refundMessages.createdAt);

    const messages = msgRows.map((m) => this.mapMessageDto(m));

    // 取最新的图片消息作为收款码
    const imageMsgs = msgRows.filter((m) => m.msgType === 'image');
    const latestImage = imageMsgs.length > 0 ? imageMsgs[imageMsgs.length - 1].imageUrl ?? '' : '';

    return { session, messages, latestImage: latestImage || null };
  }

  /** 平台发消息（管理员） */
  async sendPlatformMessage(
    sessionId: string,
    msgType: 'text' | 'image',
    content: string,
    imageUrl: string,
  ): Promise<RefundMessage> {
    const sessionRows = await this.db
      .select()
      .from(refundSessions)
      .where(eq(refundSessions.id, sessionId))
      .limit(1);

    if (sessionRows.length === 0) {
      throw new NotFoundException('退款会话不存在');
    }

    if (msgType === 'text' && !content.trim()) {
      throw new BadRequestException('消息内容不能为空');
    }

    const [inserted] = await this.db
      .insert(refundMessages)
      .values({
        sessionId,
        senderRole: 'platform',
        senderId: null,
        msgType,
        content: content ?? '',
        imageUrl: imageUrl ?? '',
        isSystem: false,
      })
      .returning();

    return this.mapMessageDto(inserted);
  }

  /** 确认已退款（管理员） */
  async confirmRefund(
    sessionId: string,
    adminName: string,
    refundAmountFen?: number,
    remark = '',
  ): Promise<RefundSession> {
    const result = await this.db.transaction(async (tx) => {
      const sessionRows = await tx
        .select()
        .from(refundSessions)
        .where(eq(refundSessions.id, sessionId))
        .limit(1);

      const sessionRow = sessionRows[0];
      if (!sessionRow) {
        throw new NotFoundException('退款会话不存在');
      }
      if (sessionRow.status !== 'pending') {
        throw new BadRequestException('该退款已处理');
      }

      const orderRows = await tx
        .select()
        .from(orders)
        .where(eq(orders.id, sessionRow.orderId))
        .limit(1);
      const orderRow = orderRows[0];
      if (!orderRow) {
        throw new NotFoundException('订单不存在');
      }

      const amountFen = refundAmountFen ?? Math.round(Number(orderRow.totalAmount) * 100);

      // 1. 更新退款会话
      const updatedSession = await tx
        .update(refundSessions)
        .set({
          status: 'refunded',
          refundAmountFen: amountFen,
          refundRemark: remark,
        })
        .where(eq(refundSessions.id, sessionId))
        .returning();

      // 2. 更新 refund_requests
      await tx
        .update(refundRequests)
        .set({
          status: 'approved',
          reviewedBy: adminName,
          reviewedAt: new Date(),
        })
        .where(eq(refundRequests.id, sessionRow.refundRequestId));

      // 3. 更新订单状态
      await tx
        .update(orders)
        .set({ status: 'refunded', paymentStatus: 'refunded' })
        .where(eq(orders.id, sessionRow.orderId));

      // 4. 写资金流水
      await tx.insert(fundTransactions).values({
        orderId: sessionRow.orderId,
        txType: 'refund',
        amountFen,
        direction: 'out',
        channel: 'offline',
        status: 'success',
        remark,
      });

      return { session: updatedSession[0], order: orderRow };
    });

    const amountYuan = (Number(result.session.refundAmountFen ?? 0) / 100).toFixed(2);

    // 给买家发通知
    void this.notificationsService.send(
      'user',
      result.order.buyerId,
      '退款已到账',
      `退款已到账 ¥${amountYuan}`,
      'order',
      result.order.id,
    );

    // 系统消息
    await this.sendSystemMessage(sessionId, `退款已完成，退款金额 ¥${amountYuan}。${remark ? `备注：${remark}` : ''}`);

    return this.buildSessionDto(result.session);
  }

  /** 拒绝退款（管理员） */
  async rejectRefund(
    sessionId: string,
    adminName: string,
    reason: string,
  ): Promise<RefundSession> {
    const result = await this.db.transaction(async (tx) => {
      const sessionRows = await tx
        .select()
        .from(refundSessions)
        .where(eq(refundSessions.id, sessionId))
        .limit(1);

      const sessionRow = sessionRows[0];
      if (!sessionRow) {
        throw new NotFoundException('退款会话不存在');
      }
      if (sessionRow.status !== 'pending') {
        throw new BadRequestException('该退款已处理');
      }

      // 1. 更新退款会话
      const updatedSession = await tx
        .update(refundSessions)
        .set({
          status: 'rejected',
          rejectReason: reason,
        })
        .where(eq(refundSessions.id, sessionId))
        .returning();

      // 2. 更新 refund_requests
      await tx
        .update(refundRequests)
        .set({
          status: 'rejected',
          rejectReason: reason,
          reviewedBy: adminName,
          reviewedAt: new Date(),
        })
        .where(eq(refundRequests.id, sessionRow.refundRequestId));

      // 3. 订单状态恢复为 paid（已付款）
      await tx
        .update(orders)
        .set({ status: 'paid' })
        .where(eq(orders.id, sessionRow.orderId));

      return { session: updatedSession[0], orderId: sessionRow.orderId };
    });

    // 找订单 buyerId
    const orderRows = await this.db
      .select({ buyerId: orders.buyerId })
      .from(orders)
      .where(eq(orders.id, result.orderId))
      .limit(1);
    const buyerId = orderRows[0]?.buyerId;

    if (buyerId) {
      void this.notificationsService.send(
        'user',
        buyerId,
        '退款申请被拒绝',
        `退款申请被拒绝：${reason}`,
        'order',
        result.orderId,
      );
    }

    // 系统消息
    await this.sendSystemMessage(sessionId, `退款申请被拒绝：${reason}`);

    return this.buildSessionDto(result.session);
  }

  // ========== 内部方法 ==========

  /** 发送系统消息 */
  async sendSystemMessage(sessionId: string, content: string): Promise<void> {
    try {
      await this.db.insert(refundMessages).values({
        sessionId,
        senderRole: 'system',
        senderId: null,
        msgType: 'text',
        content,
        imageUrl: '',
        isSystem: true,
      });
    } catch (error) {
      this.logger.error('发送系统消息失败', error);
    }
  }

  // ========== 构建 DTO ==========

  private async buildSessionDto(row: typeof refundSessions.$inferSelect): Promise<RefundSession> {
    const orderRows = await this.db
      .select()
      .from(orders)
      .where(eq(orders.id, row.orderId))
      .limit(1);
    const order = orderRows[0];

    const buyerRows = await this.db
      .select({ name: users.name, phone: users.phone })
      .from(users)
      .where(eq(users.id, row.buyerId))
      .limit(1);
    const buyer = buyerRows[0];

    const refundReqRows = await this.db
      .select()
      .from(refundRequests)
      .where(eq(refundRequests.id, row.refundRequestId))
      .limit(1);
    const refundReq = refundReqRows[0];

    return {
      id: row.id,
      orderId: row.orderId,
      buyerId: row.buyerId,
      refundRequestId: row.refundRequestId,
      status: row.status as RefundSession['status'],
      refundAmountFen: row.refundAmountFen ?? null,
      refundRemark: row.refundRemark ?? null,
      rejectReason: row.rejectReason ?? null,
      orderAmount: Number(order?.totalAmount ?? 0).toFixed(2),
      orderNo: order?.orderNo ?? '',
      buyerName: buyer?.name ?? '',
      buyerPhone: buyer?.phone ?? '',
      refundReason: refundReq?.reason ?? '',
      screenshotUrl: refundReq?.screenshotUrl ?? '',
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private mapMessageDto(row: typeof refundMessages.$inferSelect): RefundMessage {
    return {
      id: row.id,
      sessionId: row.sessionId,
      senderRole: row.senderRole as RefundMessage['senderRole'],
      senderId: row.senderId ?? null,
      msgType: row.msgType as RefundMessage['msgType'],
      content: row.content ?? '',
      imageUrl: row.imageUrl ?? '',
      isSystem: row.isSystem,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
