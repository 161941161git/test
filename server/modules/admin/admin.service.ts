import {
  Injectable,
  Inject,
  Logger,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
  ConflictException,
  OnModuleInit,
  forwardRef,
} from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@server/database/database.module';
import { eq, and, desc, count, sql, inArray, gte, lt, notInArray } from 'drizzle-orm';
import { compare, hash } from 'bcryptjs';
import { randomUUID } from 'crypto';

import {
  admins,
  orders,
  refundRequests,
  withdrawRequests,
  users,
  chatMessages,
  orderPackages,
  paymentOrders,
  profitSharingRecords,
  settlementSessions,
  fundTransactions,
  runnerApplications,
  notifications,
} from '@server/database/schema';
import type {
  AdminLoginResponse,
  AdminDashboard,
  RefundRequest,
  Order,
  User,
  Package,
  ChatMessage,
  OrderListResponse,
  FundTransaction,
  FundTxListResponse,
  PaymentConfig,
  WithdrawRequest,
  RunnerApplication,
  RunnerApplyStatus,
  NotificationListResponse,
} from '@shared/api.interface';
import { isRunnerApplyStatus } from '@shared/api.interface';
import { PaymentService } from '../payment/payment.service';
import { NotificationsService } from '../notifications/notifications.service';

function fmtMoney(val: string | number): string {
  const num = typeof val === 'string' ? Number(val) : val;
  return Number.isFinite(num) ? num.toFixed(2) : '0.00';
}

function fmtDate(val: Date | string | null): string | null {
  if (!val) return null;
  const d = val instanceof Date ? val : new Date(val);
  return d.toISOString();
}

@Injectable()
export class AdminService implements OnModuleInit {
  private readonly logger = new Logger(AdminService.name);
  private readonly tokenStore = new Map<string, { adminId: string; username: string; name: string }>();

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
    private readonly paymentService: PaymentService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async onModuleInit(): Promise<void> {
    const rows = await this.db.select().from(admins).limit(1);
    if (rows.length === 0) {
      // 账号密码通过环境变量注入，不写死在代码里
      const seedPassword = process.env.SEED_ADMIN_PASSWORD;
      if (!seedPassword) {
        this.logger.warn('未配置 SEED_ADMIN_PASSWORD，跳过管理员账号初始化');
        return;
      }
      const seedUsername = process.env.SEED_ADMIN_USERNAME || 'xushenxin050831';
      const passwordHash = await hash(seedPassword, 10);
      await this.db.insert(admins).values({
        username: seedUsername,
        passwordHash,
        name: '管理员',
      });
      this.logger.log(`默认管理员账号已初始化: ${seedUsername}`);
    } else {
      for (const admin of rows) {
        if (!admin.passwordHash.startsWith('$2')) {
          const newHash = await hash(admin.passwordHash, 10);
          await this.db
            .update(admins)
            .set({ passwordHash: newHash })
            .where(eq(admins.id, admin.id));
          this.logger.log(`管理员 ${admin.username} 密码已升级为 bcrypt 哈希`);
        }
      }
    }
  }

  generateToken(adminId: string, username: string, name: string): string {
    const token = randomUUID();
    this.tokenStore.set(token, { adminId, username, name });
    return token;
  }

  validateToken(token: string): { adminId: string; username: string; name: string } | null {
    return this.tokenStore.get(token) ?? null;
  }

  revokeToken(token: string): void {
    this.tokenStore.delete(token);
  }

  // ========== 登录 ==========
  async login(username: string, password: string): Promise<AdminLoginResponse> {
    const rows = await this.db
      .select()
      .from(admins)
      .where(eq(admins.username, username))
      .limit(1);

    const admin = rows[0];
    if (!admin) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    const passwordValid = await compare(password, admin.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    const token = this.generateToken(admin.id, admin.username, admin.name);

    return {
      adminId: admin.id,
      username: admin.username,
      name: admin.name,
      token,
    };
  }

  // ========== 修改密码 ==========
  async changePassword(adminId: string, oldPassword: string, newPassword: string): Promise<void> {
    const rows = await this.db.select().from(admins).where(eq(admins.id, adminId)).limit(1);
    const admin = rows[0];
      if (!admin) {
        throw new NotFoundException('管理员不存在');
      }

      const oldValid = await compare(oldPassword, admin.passwordHash);
      if (!oldValid) {
        throw new BadRequestException('旧密码错误');
      }

    const newHash = await hash(newPassword, 10);
    const updated = await this.db
      .update(admins)
      .set({ passwordHash: newHash })
      .where(eq(admins.id, adminId))
      .returning({ id: admins.id });

    if (updated.length === 0) {
      throw new NotFoundException('管理员不存在');
    }
  }

  // ========== 看板数据 ==========
  async getDashboard(): Promise<AdminDashboard> {
    // 今日（Asia/Shanghai，UTC+8）起始时间
    const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000;
    const nowUtcMs = Date.now();
    const shanghaiMs = nowUtcMs + SHANGHAI_OFFSET_MS;
    const shanghaiDayStartMs = Math.floor(shanghaiMs / 86400000) * 86400000;
    const todayStart = new Date(shanghaiDayStartMs - SHANGHAI_OFFSET_MS);
    const todayEnd = new Date(todayStart.getTime() + 86400000);


    const [
      totalRes, pendingRes, inProgressRes, completedRes,
      refundRes,
      unpaidRes, escrowRes, todayRes,
      sharingRes, adminRows,
      pendingVerifyRes, pendingPayoutRes,
      pendingRunnerRes, approvedRunnerRes,
      todayNewOrdersRes,
      unreadNotifRes,
    ] = await Promise.all([
      this.db.select({ count: count() }).from(orders),
      this.db.select({ count: count() }).from(orders).where(eq(orders.status, 'pending')),
      this.db.select({ count: count() }).from(orders).where(eq(orders.status, 'in_progress')),
      this.db.select({ count: count() }).from(orders).where(eq(orders.status, 'completed')),
      this.db.select({ count: count() }).from(refundRequests).where(eq(refundRequests.status, 'pending')),
      // 待支付金额：payment_status=unpaid 的订单总和
      this.db
        .select({ total: sql<string>`COALESCE(SUM(${orders.totalAmount}), 0)` })
        .from(orders)
        .where(eq(orders.paymentStatus, 'unpaid')),
      // 托管中金额：已支付但未完成/未退款的订单总和
      this.db
        .select({ total: sql<string>`COALESCE(SUM(${orders.totalAmount}), 0)` })
        .from(orders)
        .where(and(
          eq(orders.paymentStatus, 'paid'),
          notInArray(orders.status, ['completed', 'refunded']),
        )),
      // 今日成交额：今日支付成功的订单总和
      this.db
        .select({ total: sql<string>`COALESCE(SUM(${orders.totalAmount}), 0)` })
        .from(orders)
        .where(and(
          eq(orders.paymentStatus, 'paid'),
          gte(orders.paidAt, todayStart),
        )),
      // 累计已分账金额：profit_sharing_records 成功的总和
      this.db
        .select({ total: sql<number>`COALESCE(SUM(${profitSharingRecords.platformAmountFen} + ${profitSharingRecords.runnerAmountFen}), 0)` })
        .from(profitSharingRecords)
        .where(eq(profitSharingRecords.status, 'success')),
      this.db.select().from(admins).limit(1),
      // 待核对付款数与金额合计
      this.db
        .select({
          count: count(),
          total: sql<string>`COALESCE(SUM(${orders.totalAmount}), 0)`,
        })
        .from(orders)
        .where(eq(orders.paymentStatus, 'pending_verify')),
      // 待打款给跑腿员总额（settlement_sessions pending_settle）
      this.db
        .select({ total: sql<number>`COALESCE(SUM(${settlementSessions.runnerAmountFen}), 0)` })
        .from(settlementSessions)
        .where(eq(settlementSessions.status, 'pending_settle')),
      // 待审核兼职申请数
      this.db
        .select({ count: count() })
        .from(runnerApplications)
        .where(eq(runnerApplications.status, 'pending')),
      // 已通过的跑腿员数
      this.db
        .select({ count: count() })
        .from(users)
        .where(eq(users.isRunner, true)),
      // 今日新增订单数（按自然日 Asia/Shanghai）
      this.db
        .select({ count: count() })
        .from(orders)
        .where(and(gte(orders.createdAt, todayStart), lt(orders.createdAt, todayEnd))),
      // 管理员未读通知数
      this.db
        .select({ count: count() })
        .from(notifications)
        .where(and(
          eq(notifications.recipientType, 'admin'),
          eq(notifications.recipientId, 'admin'),
          eq(notifications.isRead, false),
        )),
    ]);

    const amountRes = await this.db
      .select({ total: sql<string>`COALESCE(SUM(${orders.totalAmount}), 0)` })
      .from(orders)
      .where(eq(orders.status, 'completed'));

    const platformEarnings = adminRows[0]?.platformEarnings ?? '0';

    // 累计分账总额（元）：平台+跑腿 分（从 DB 取的是 fen 整数）
    const totalSharingFen = Number(sharingRes[0]?.total ?? 0);

    return {
      totalOrders: Number(totalRes[0]?.count ?? 0),
      pendingOrders: Number(pendingRes[0]?.count ?? 0),
      inProgressOrders: Number(inProgressRes[0]?.count ?? 0),
      completedOrders: Number(completedRes[0]?.count ?? 0),
      totalAmount: fmtMoney(amountRes[0]?.total ?? '0'),
      platformEarnings: fmtMoney(platformEarnings),
      pendingRefunds: Number(refundRes[0]?.count ?? 0),
      pendingWithdraws: 0,
      // 资金看板扩展
      unpaidAmount: fmtMoney(unpaidRes[0]?.total ?? '0'),
      escrowAmount: fmtMoney(escrowRes[0]?.total ?? '0'),
      todayAmount: fmtMoney(todayRes[0]?.total ?? '0'),
      totalSharingAmount: fmtMoney(totalSharingFen / 100),
      platformFeeTotal: fmtMoney(platformEarnings),
      // 线下收款码模式扩展（兼容旧字段）
      pendingVerifyPayments: Number(pendingVerifyRes[0]?.count ?? 0),
      escrowAmountVerified: fmtMoney(escrowRes[0]?.total ?? '0'),
      pendingSettlementAmount: fmtMoney(Number(pendingPayoutRes[0]?.total ?? 0) / 100),
      settledAmount: '0.00',
      // 待核对付款
      pendingVerifyCount: Number(pendingVerifyRes[0]?.count ?? 0),
      pendingVerifyAmount: fmtMoney(pendingVerifyRes[0]?.total ?? '0'),
      // 待打款给跑腿员总额
      pendingPayoutAmount: fmtMoney(Number(pendingPayoutRes[0]?.total ?? 0) / 100),
      // 兼职审核
      pendingRunnerApplications: Number(pendingRunnerRes[0]?.count ?? 0),
      approvedRunnerCount: Number(approvedRunnerRes[0]?.count ?? 0),
      todayNewOrders: Number(todayNewOrdersRes[0]?.count ?? 0),
      unreadNotifications: Number(unreadNotifRes[0]?.count ?? 0),
    };
  }

  // ========== 退款列表 ==========
  async getRefundList(status?: string): Promise<{ items: RefundRequest[]; total: number }> {
    const conditions = [];
    if (status) conditions.push(eq(refundRequests.status, status));

    const base = conditions.length > 0
      ? this.db.select().from(refundRequests).where(and(...conditions))
      : this.db.select().from(refundRequests);

    const refundRows = await base.orderBy(desc(refundRequests.createdAt));

    const countRes = conditions.length > 0
      ? await this.db.select({ count: count() }).from(refundRequests).where(and(...conditions))
      : await this.db.select({ count: count() }).from(refundRequests);

    if (refundRows.length === 0) {
      return { items: [], total: Number(countRes[0]?.count ?? 0) };
    }

    const orderIds = refundRows.map((r) => r.orderId);
    const ordersList = await this.db
      .select()
      .from(orders)
      .where(inArray(orders.id, orderIds));
    const orderMap = new Map(ordersList.map((o) => [o.id, o]));

    const buyerIds = refundRows.map((r) => r.buyerId);
    const runnerIds = ordersList.map((o) => o.runnerId).filter((id): id is string => !!id);
    const userIds = [...new Set([...buyerIds, ...runnerIds])];
    const userList = userIds.length > 0
      ? await this.db.select().from(users).where(inArray(users.id, userIds))
      : [];
    const userMap = new Map(userList.map((u) => [u.id, u]));

    const items: RefundRequest[] = refundRows.map((r) => {
      const order = orderMap.get(r.orderId);
      const buyer = userMap.get(r.buyerId);
      const runner = order?.runnerId ? userMap.get(order.runnerId) : undefined;
      return {
        id: r.id,
        orderId: r.orderId,
        buyerId: r.buyerId,
        buyerName: buyer?.name ?? '',
        buyerPhone: buyer?.phone ?? '',
        buyerDormitory: buyer?.dormitory ?? '',
        runnerId: order?.runnerId ?? null,
        runnerName: runner?.name ?? null,
        runnerPhone: runner?.phone ?? null,
        runnerWechat: runner?.wechatId ?? null,
        reason: r.reason,
        status: r.status as RefundRequest['status'],
        rejectReason: r.rejectReason,
        reviewedBy: r.reviewedBy ?? '',
        reviewedAt: fmtDate(r.reviewedAt ?? null),
        orderAmount: fmtMoney(order?.totalAmount ?? '0'),
        packageCount: order?.packageCount ?? 0,
        isRainy: order?.isRainy ?? false,
        isUrgent: order?.isUrgent ?? false,
        refundAmount: fmtMoney(order?.totalAmount ?? '0'),
        screenshotUrl: r.screenshotUrl ?? '',
        sessionId: '',
        createdAt: fmtDate(r.createdAt) ?? r.createdAt.toISOString(),
      };
    });

    return { items, total: Number(countRes[0]?.count ?? 0) };
  }

  // ========== 退款详情 ==========
  async getRefundDetail(id: string): Promise<{
    refund: RefundRequest;
    order: Order;
    messages: ChatMessage[];
  }> {
    const refundRows = await this.db
      .select()
      .from(refundRequests)
      .where(eq(refundRequests.id, id))
      .limit(1);
    const refundRow = refundRows[0];
    if (!refundRow) {
      throw new NotFoundException('退款记录不存在');
    }

    const orderRows = await this.db
      .select()
      .from(orders)
      .where(eq(orders.id, refundRow.orderId))
      .limit(1);
    const orderRow = orderRows[0];
    if (!orderRow) {
      throw new NotFoundException('订单不存在');
    }

    const userIds = [refundRow.buyerId];
    if (orderRow.runnerId) userIds.push(orderRow.runnerId);
    const userList = await this.db
      .select()
      .from(users)
      .where(inArray(users.id, userIds));
    const userMap = new Map(userList.map((u) => [u.id, u]));

    const buyer = userMap.get(refundRow.buyerId);
    const runner = orderRow.runnerId ? userMap.get(orderRow.runnerId) : undefined;

    const packages = await this.db
      .select()
      .from(orderPackages)
      .where(eq(orderPackages.orderId, orderRow.id));

    const msgRows = await this.db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.orderId, orderRow.id))
      .orderBy(chatMessages.createdAt);

    const sessionRows = await this.db
      .select({ id: settlementSessions.id })
      .from(settlementSessions)
      .where(eq(settlementSessions.orderId, orderRow.id))
      .limit(1);
    const settlementSessionId = sessionRows[0]?.id ?? null;

    const refund: RefundRequest = {
      id: refundRow.id,
      orderId: refundRow.orderId,
      buyerId: refundRow.buyerId,
      buyerName: buyer?.name ?? '',
      buyerPhone: buyer?.phone ?? '',
      buyerDormitory: buyer?.dormitory ?? '',
      runnerId: orderRow.runnerId ?? null,
      runnerName: runner?.name ?? null,
      runnerPhone: runner?.phone ?? null,
      runnerWechat: runner?.wechatId ?? null,
      reason: refundRow.reason,
      status: refundRow.status as RefundRequest['status'],
      rejectReason: refundRow.rejectReason,
      reviewedBy: refundRow.reviewedBy ?? '',
      reviewedAt: fmtDate(refundRow.reviewedAt ?? null),
      orderAmount: fmtMoney(orderRow.totalAmount),
      packageCount: orderRow.packageCount,
      isRainy: orderRow.isRainy,
      isUrgent: orderRow.isUrgent,
      refundAmount: fmtMoney(orderRow.totalAmount),
      screenshotUrl: refundRow.screenshotUrl ?? '',
      sessionId: '',
      createdAt: fmtDate(refundRow.createdAt) ?? refundRow.createdAt.toISOString(),
    };

    const order: Order = {
      id: orderRow.id,
      orderNo: orderRow.orderNo,
      buyerId: orderRow.buyerId,
      buyerName: buyer?.name ?? '',
      buyerPhone: buyer?.phone ?? '',
      runnerId: orderRow.runnerId ?? null,
      runnerName: runner?.name ?? null,
      runnerPhone: runner?.phone ?? null,
      status: orderRow.status as Order['status'],
      totalAmount: fmtMoney(orderRow.totalAmount),
      baseFee: fmtMoney(orderRow.baseFee),
      extraFee: fmtMoney(orderRow.extraFee),
      rainyFee: fmtMoney(orderRow.rainyFee),
      urgentFee: fmtMoney(orderRow.urgentFee),
      isRainy: orderRow.isRainy,
      isUrgent: orderRow.isUrgent,
      packageCount: orderRow.packageCount,
      dormitory: orderRow.dormitory,
      contactPhone: orderRow.contactPhone,
      remark: orderRow.remark,
      runnerEarnings: fmtMoney(orderRow.runnerEarnings),
      platformFee: fmtMoney(orderRow.platformFee),
      paymentStatus: orderRow.paymentStatus as Order['paymentStatus'],
      payChannel: (orderRow.payChannel as Order['payChannel']) ?? null,
      thirdPartyTradeNo: orderRow.thirdPartyTradeNo ?? null,
      paidAt: fmtDate(orderRow.paidAt ?? null),
      payProofUrl: orderRow.payProofUrl,
      payRemark: orderRow.payRemark,
      deliveredAt: fmtDate(orderRow.deliveredAt ?? null),
      confirmedAt: fmtDate(orderRow.confirmedAt ?? null),
      autoSettleAt: fmtDate(orderRow.autoSettleAt ?? null),
      settlementSessionId,
      packages: packages.map((p): Package => ({
        id: p.id,
        orderId: p.orderId,
        trackingNo: p.trackingNo,
        pickupPhone: p.pickupPhone,
        size: p.size as Package['size'],
      })),
      createdAt: fmtDate(orderRow.createdAt) ?? orderRow.createdAt.toISOString(),
    };

    const msgUserIds = [...new Set(msgRows.map((m) => m.senderId))];
    const msgUsers = msgUserIds.length > 0
      ? await this.db.select().from(users).where(inArray(users.id, msgUserIds))
      : [];
    const msgUserMap = new Map(msgUsers.map((u) => [u.id, u]));

    const messages: ChatMessage[] = msgRows.map((m) => ({
      id: m.id,
      orderId: m.orderId,
      senderId: m.senderId,
      senderRole: m.senderRole as ChatMessage['senderRole'],
      senderName: msgUserMap.get(m.senderId)?.name ?? '',
      msgType: m.msgType as ChatMessage['msgType'],
      content: m.content,
      imageUrl: m.imageUrl,
      isDeliveryPhoto: m.isDeliveryPhoto,
      createdAt: fmtDate(m.createdAt) ?? m.createdAt.toISOString(),
    }));

    return { refund, order, messages };
  }

  // ========== 审核退款 - 通过 ==========
  async approveRefund(id: string, adminName: string): Promise<RefundRequest> {
    const result = await this.db.transaction(async (tx) => {
      const refundRows = await tx
        .select()
        .from(refundRequests)
        .where(eq(refundRequests.id, id))
        .limit(1);
      const refundRow = refundRows[0];
      if (!refundRow) {
        throw new NotFoundException('退款记录不存在');
      }
      if (refundRow.status !== 'pending') {
        throw new BadRequestException('退款申请已处理');
      }

      const orderRows = await tx
        .select()
        .from(orders)
        .where(eq(orders.id, refundRow.orderId))
        .limit(1);
      const orderRow = orderRows[0];
      if (!orderRow) {
        throw new NotFoundException('订单不存在');
      }

      // 1. 更新退款状态
      const updatedRefund = await tx
        .update(refundRequests)
        .set({
          status: 'approved',
          reviewedBy: adminName,
          reviewedAt: new Date(),
        })
        .where(eq(refundRequests.id, id))
        .returning();

      // 2. 更新订单状态和支付状态
      await tx
        .update(orders)
        .set({ status: 'refunded', paymentStatus: 'refunded' })
        .where(eq(orders.id, refundRow.orderId));

      // 3. 如果订单已完成/退款中且已有结算，回滚结算
      const hasSettled = orderRow.status === 'completed' ||
        (orderRow.status === 'refunding' && orderRow.confirmedAt);
      if (hasSettled && orderRow.runnerId) {
        const runnerEarnings = Number(orderRow.runnerEarnings);
        const platformFee = Number(orderRow.platformFee);

        // 扣回跑腿员余额、总收益、总订单数
        await tx
          .update(users)
          .set({
            balance: sql`${users.balance} - ${runnerEarnings.toFixed(2)}::numeric`,
            totalEarnings: sql`${users.totalEarnings} - ${runnerEarnings.toFixed(2)}::numeric`,
            totalOrders: sql`${users.totalOrders} - 1`,
          })
          .where(eq(users.id, orderRow.runnerId));

        // 扣回平台收益
        const adminRow = (await tx.select().from(admins).limit(1))[0];
        if (adminRow) {
          await tx
            .update(admins)
            .set({
              platformEarnings: sql`${admins.platformEarnings} - ${platformFee.toFixed(2)}::numeric`,
            })
            .where(eq(admins.id, adminRow.id));
        }
      }

      // 4. 新增退款冲正流水
      const totalAmountFen = Math.round(Number(orderRow.totalAmount) * 100);
      await tx.insert(fundTransactions).values({
        txType: 'refund',
        amountFen: totalAmountFen,
        direction: 'out',
        channel: 'offline',
        status: 'success',
        orderId: orderRow.id,
        remark: `退款冲正，订单号：${orderRow.orderNo}，操作人：${adminName}`,
      });

      return updatedRefund[0];
    });

    // 调用支付服务执行退款（事务提交后执行）
    await this.paymentService.refundPayment(result.orderId, id);

    // 重新组装返回
    const refund = this.getRefundById(result.id);

    // 通知买家：退款已通过
    void this.notificationsService.send(
      'user',
      result.buyerId,
      '退款已通过',
      `退款申请已通过，请注意查收`,
      'order',
      result.orderId,
    );

    return refund;
  }

  // ========== 确认到账 / 未收到款 ==========
  async verifyPayment(orderId: string, verified: boolean, adminName: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      const orderRows = await tx
        .select()
        .from(orders)
        .where(eq(orders.id, orderId))
        .limit(1);
      const orderRow = orderRows[0];
      if (!orderRow) {
        throw new NotFoundException('订单不存在');
      }
      if (orderRow.paymentStatus !== 'pending_verify') {
        throw new BadRequestException('当前订单状态不支持核对操作');
      }

      if (verified) {
        // 确认到账
        await tx
          .update(orders)
          .set({ paymentStatus: 'paid' })
          .where(eq(orders.id, orderId));

        // 创建 payment_order 记录（状态直接为 paid），供退款等流程使用
        const amountFen = Math.round(Number(orderRow.totalAmount) * 100);
        const payNo = `PAY${Date.now()}${Math.floor(Math.random() * 9000 + 1000)}`;
        const thirdPartyNo = `MANUAL${Date.now()}${Math.floor(Math.random() * 9000 + 1000)}`;
        await tx.insert(paymentOrders).values({
          orderId,
          payNo,
          amountFen,
          channel: orderRow.payChannel ?? 'wechat_qr',
          status: 'paid',
          thirdPartyTradeNo: thirdPartyNo,
          paidAt: new Date(),
        });

        // 更新对应 buyer_payment 流水状态
        const txRows = await tx
          .select()
          .from(fundTransactions)
          .where(and(
            eq(fundTransactions.orderId, orderId),
            eq(fundTransactions.txType, 'buyer_payment'),
          ))
          .orderBy(desc(fundTransactions.createdAt))
          .limit(1);
        if (txRows.length > 0) {
          const existing = txRows[0];
          const newRemark = existing.remark
            ? `${existing.remark}；已确认到账，操作人：${adminName}`
            : `已确认到账，操作人：${adminName}`;
          await tx
            .update(fundTransactions)
            .set({ status: 'success', remark: newRemark })
            .where(eq(fundTransactions.id, existing.id));
        }
      } else {
        // 未收到款
        await tx
          .update(orders)
          .set({
            paymentStatus: 'unpaid',
            payChannel: null,
            paidAt: null,
            payProofUrl: '',
            payRemark: '',
          })
          .where(eq(orders.id, orderId));

        // 更新对应 buyer_payment 流水为 failed
        const txRows = await tx
          .select()
          .from(fundTransactions)
          .where(and(
            eq(fundTransactions.orderId, orderId),
            eq(fundTransactions.txType, 'buyer_payment'),
          ))
          .orderBy(desc(fundTransactions.createdAt))
          .limit(1);
        if (txRows.length > 0) {
          await tx
            .update(fundTransactions)
            .set({
              status: 'failed',
              remark: '未收到款，退回待支付',
            })
            .where(eq(fundTransactions.id, txRows[0].id));
        }
      }
    });
  }

  // ========== 审核退款 - 拒绝 ==========
  async rejectRefund(id: string, adminName: string, rejectReason: string): Promise<RefundRequest> {
    const result = await this.db.transaction(async (tx) => {
      const refundRows = await tx
        .select()
        .from(refundRequests)
        .where(eq(refundRequests.id, id))
        .limit(1);
      const refundRow = refundRows[0];
      if (!refundRow) {
        throw new NotFoundException('退款记录不存在');
      }
      if (refundRow.status !== 'pending') {
        throw new BadRequestException('退款申请已处理');
      }

      // 1. 更新退款状态
      const updatedRefund = await tx
        .update(refundRequests)
        .set({
          status: 'rejected',
          rejectReason,
          reviewedBy: adminName,
          reviewedAt: new Date(),
        })
        .where(eq(refundRequests.id, id))
        .returning();

      // 2. 订单状态回退到 delivered
      await tx
        .update(orders)
        .set({ status: 'delivered' })
        .where(eq(orders.id, refundRow.orderId));

      return updatedRefund[0];
    });

    // 通知买家：退款被拒绝
    void this.notificationsService.send(
      'user',
      result.buyerId,
      '退款被拒绝',
      `退款申请未通过：${rejectReason}`,
      'order',
      result.orderId,
    );

    return this.getRefundById(result.id);
  }

  // ========== 订单列表 ==========
  async getOrderList(status?: string): Promise<OrderListResponse> {
    const conditions = [];
    if (status) conditions.push(eq(orders.status, status));

    const base = conditions.length > 0
      ? this.db.select().from(orders).where(and(...conditions))
      : this.db.select().from(orders);

    const orderRows = await base.orderBy(desc(orders.createdAt)).limit(100);
    const countRes = conditions.length > 0
      ? await this.db.select({ count: count() }).from(orders).where(and(...conditions))
      : await this.db.select({ count: count() }).from(orders);

    if (orderRows.length === 0) {
      return { items: [], total: Number(countRes[0]?.count ?? 0) };
    }

    const userIds = [
      ...new Set([
        ...orderRows.map((o) => o.buyerId),
        ...orderRows.map((o) => o.runnerId).filter((id): id is string => !!id),
      ]),
    ];
    const userList = userIds.length > 0
      ? await this.db.select().from(users).where(inArray(users.id, userIds))
      : [];
    const userMap = new Map(userList.map((u) => [u.id, u]));

    const orderIds = orderRows.map((o) => o.id);
    const pkgRows = await this.db
      .select()
      .from(orderPackages)
      .where(inArray(orderPackages.orderId, orderIds));
    const pkgMap = new Map<string, Package[]>();
    for (const p of pkgRows) {
      const arr = pkgMap.get(p.orderId) ?? [];
      arr.push({
        id: p.id,
        orderId: p.orderId,
        trackingNo: p.trackingNo,
        pickupPhone: p.pickupPhone,
        size: p.size as Package['size'],
      });
      pkgMap.set(p.orderId, arr);
    }

    // 批量查结算会话
    const sessionRows = await this.db
      .select({ id: settlementSessions.id, orderId: settlementSessions.orderId })
      .from(settlementSessions)
      .where(inArray(settlementSessions.orderId, orderIds));
    const sessionMap = new Map<string, string>();
    for (const s of sessionRows) {
      if (!sessionMap.has(s.orderId)) {
        sessionMap.set(s.orderId, s.id);
      }
    }

    const items: Order[] = orderRows.map((o) => {
      const buyer = userMap.get(o.buyerId);
      const runner = o.runnerId ? userMap.get(o.runnerId) : undefined;
      return {
        id: o.id,
        orderNo: o.orderNo,
        buyerId: o.buyerId,
        buyerName: buyer?.name ?? '',
        buyerPhone: buyer?.phone ?? '',
        runnerId: o.runnerId ?? null,
        runnerName: runner?.name ?? null,
        runnerPhone: runner?.phone ?? null,
        status: o.status as Order['status'],
        totalAmount: fmtMoney(o.totalAmount),
        baseFee: fmtMoney(o.baseFee),
        extraFee: fmtMoney(o.extraFee),
        rainyFee: fmtMoney(o.rainyFee),
        urgentFee: fmtMoney(o.urgentFee),
        isRainy: o.isRainy,
        isUrgent: o.isUrgent,
        packageCount: o.packageCount,
        dormitory: o.dormitory,
        contactPhone: o.contactPhone,
        remark: o.remark,
        runnerEarnings: fmtMoney(o.runnerEarnings),
        platformFee: fmtMoney(o.platformFee),
        paymentStatus: o.paymentStatus as Order['paymentStatus'],
        payChannel: (o.payChannel as Order['payChannel']) ?? null,
        thirdPartyTradeNo: o.thirdPartyTradeNo ?? null,
        paidAt: fmtDate(o.paidAt ?? null),
        payProofUrl: o.payProofUrl,
        payRemark: o.payRemark,
        deliveredAt: fmtDate(o.deliveredAt ?? null),
        confirmedAt: fmtDate(o.confirmedAt ?? null),
        autoSettleAt: fmtDate(o.autoSettleAt ?? null),
        settlementSessionId: sessionMap.get(o.id) ?? null,
        packages: pkgMap.get(o.id) ?? [],
        createdAt: fmtDate(o.createdAt) ?? o.createdAt.toISOString(),
      };
    });

    return { items, total: Number(countRes[0]?.count ?? 0) };
  }

  // ========== 用户列表 ==========
  async getUserList(isRunner?: boolean): Promise<{ items: User[]; total: number }> {
    const conditions = [];
    if (isRunner !== undefined) conditions.push(eq(users.isRunner, isRunner));

    const base = conditions.length > 0
      ? this.db.select().from(users).where(and(...conditions))
      : this.db.select().from(users);

    const userRows = await base.orderBy(desc(users.createdAt)).limit(200);
    const countRes = conditions.length > 0
      ? await this.db.select({ count: count() }).from(users).where(and(...conditions))
      : await this.db.select({ count: count() }).from(users);

    const items: User[] = userRows.map((u) => ({
      id: u.id,
      phone: u.phone,
      name: u.name,
      dormitory: u.dormitory,
      balance: fmtMoney(u.balance),
      totalOrders: u.totalOrders,
      totalEarnings: fmtMoney(u.totalEarnings),
      isRunner: u.isRunner,
      wechatId: u.wechatId ?? '',
      wechatQrUrl: u.wechatQrUrl ?? '',
      alipayQrUrl: u.alipayQrUrl ?? '',
      userRole: u.userRole as User['userRole'],
      runnerStatus: u.isRunner ? 'approved' : 'none',
      createdAt: fmtDate(u.createdAt) ?? u.createdAt.toISOString(),
    }));

    return { items, total: Number(countRes[0]?.count ?? 0) };
  }

  // ========== 平台收益详情 ==========
  async getEarnings(): Promise<{ totalEarnings: string; availableWithdraw: string }> {
    const adminRows = await this.db.select().from(admins).limit(1);
    const total = adminRows[0]?.platformEarnings ?? '0';
    const totalEarnings = fmtMoney(total);
    return {
      totalEarnings,
      availableWithdraw: totalEarnings,
    };
  }

  // ========== 平台提现 ==========
  async platformWithdraw(adminId: string, amountStr: string): Promise<{ remaining: string }> {
    const amount = Number(amountStr);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('提现金额无效');
    }

    const result = await this.db.transaction(async (tx) => {
      const adminRows = await tx
        .select()
        .from(admins)
        .where(eq(admins.id, adminId))
        .limit(1);
      const admin = adminRows[0];
      if (!admin) {
        throw new NotFoundException('管理员不存在');
      }

      const currentEarnings = Number(admin.platformEarnings);
      if (currentEarnings < amount) {
        throw new ConflictException('平台收益不足');
      }

      const remaining = (currentEarnings - amount).toFixed(2);
      const updated = await tx
        .update(admins)
        .set({ platformEarnings: remaining })
        .where(eq(admins.id, adminId))
        .returning({ platformEarnings: admins.platformEarnings });

      if (updated.length === 0) {
        throw new BadRequestException('提现失败');
      }

      return { remaining: fmtMoney(updated[0].platformEarnings) };
    });

    return result;
  }

  // ========== 支付配置 ==========
  async getPaymentConfig(): Promise<PaymentConfig> {
    const config = await this.paymentService.getConfig();
    return { ...(config as PaymentConfig), isManualMode: true };
  }

  async savePaymentConfig(dto: Partial<PaymentConfig> & { paymentMode: 'mock' | 'real' }): Promise<PaymentConfig> {
    const saved = await this.paymentService.saveConfig(dto as any);
    return saved as PaymentConfig;
  }

  // ========== 资金流水 ==========
  async getFundTransactions(
    page = 1,
    pageSize = 20,
    txType?: string,
    status?: string,
  ): Promise<FundTxListResponse> {
    const result = await this.paymentService.getFundTransactions({
      page,
      pageSize,
      txType,
      status,
    });
    return {
      items: result.items as FundTransaction[],
      total: result.total,
    };
  }

  // ========== 重试分账 ==========
  async retryProfitSharing(orderId: string): Promise<{ success: boolean }> {
    await this.paymentService.retryProfitSharing(orderId);
    return { success: true };
  }

  // ========== 兼职审核列表 ==========
  async getRunnerApplications(
    status?: string,
    page = 1,
    pageSize = 20,
  ): Promise<{ items: RunnerApplication[]; total: number }> {
    const offset = (page - 1) * pageSize;
    const conditions = [];
    if (status && (isRunnerApplyStatus(status))) {
      conditions.push(eq(runnerApplications.status, status));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // pending 排在最前，然后按创建时间倒序
    const listQuery = this.db
      .select()
      .from(runnerApplications)
      .where(whereClause)
      .orderBy(
        sql`CASE WHEN ${runnerApplications.status} = 'pending' THEN 0 ELSE 1 END`,
        desc(runnerApplications.createdAt),
      )
      .limit(pageSize)
      .offset(offset);

    const countQuery = this.db
      .select({ count: count() })
      .from(runnerApplications)
      .where(whereClause);

    const [listResult, countResult] = await Promise.all([listQuery, countQuery]);

    const items: RunnerApplication[] = listResult.map((row) => ({
      id: row.id,
      userId: row.userId,
      name: row.name,
      phone: row.phone,
      wechatId: row.wechatId,
      paymentQrUrl: (row as any).paymentQrUrl ?? '',
      status: (isRunnerApplyStatus(row.status) ? row.status : 'pending') as RunnerApplyStatus,
      rejectReason: row.rejectReason ?? '',
      reviewedBy: row.reviewedBy ?? '',
      reviewedAt: row.reviewedAt ? row.reviewedAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
    }));

    return { items, total: Number(countResult[0]?.count ?? 0) };
  }

  // ========== 审核兼职申请 - 通过 ==========
  async approveRunnerApplication(id: string, adminName: string): Promise<RunnerApplication> {
    const result = await this.db.transaction(async (tx) => {
      const appRows = await tx
        .select()
        .from(runnerApplications)
        .where(eq(runnerApplications.id, id))
        .limit(1);

      if (appRows.length === 0) {
        throw new NotFoundException('申请记录不存在');
      }

      const app = appRows[0];
      if (app.status !== 'pending') {
        throw new BadRequestException('该申请已处理');
      }

      // 更新申请状态
      const updated = await tx
        .update(runnerApplications)
        .set({
          status: 'approved',
          reviewedBy: adminName,
          reviewedAt: new Date(),
        })
        .where(eq(runnerApplications.id, id))
        .returning();

      // 更新用户为跑腿员
      await tx
        .update(users)
        .set({
          isRunner: true,
          userRole: 'runner',
          wechatQrUrl: app.paymentQrUrl ?? '',
        })
        .where(eq(users.id, app.userId));

      return updated[0];
    });

    // 通知用户：兼职申请已通过
    void this.notificationsService.send(
      'user',
      result.userId,
      '兼职申请已通过',
      '你的兼职申请已通过，可以去接单啦',
      'runner-application',
      id,
    );

    const status = isRunnerApplyStatus(result.status) ? result.status : 'pending';
    return {
      id: result.id,
      userId: result.userId,
      name: result.name,
      phone: result.phone,
      wechatId: result.wechatId,
      paymentQrUrl: (result as any).paymentQrUrl ?? '',
      status,
      rejectReason: result.rejectReason ?? '',
      reviewedBy: result.reviewedBy ?? '',
      reviewedAt: result.reviewedAt ? result.reviewedAt.toISOString() : null,
      createdAt: result.createdAt.toISOString(),
    };
  }

  // ========== 审核兼职申请 - 拒绝 ==========
  async rejectRunnerApplication(
    id: string,
    adminName: string,
    rejectReason: string,
  ): Promise<RunnerApplication> {
    const updated = await this.db
      .update(runnerApplications)
      .set({
        status: 'rejected',
        reviewedBy: adminName,
        reviewedAt: new Date(),
        rejectReason,
      })
      .where(and(
        eq(runnerApplications.id, id),
        eq(runnerApplications.status, 'pending'),
      ))
      .returning();

    if (updated.length === 0) {
      throw new BadRequestException('申请不存在或已处理');
    }

    const result = updated[0];

    // 通知用户：兼职申请未通过
    void this.notificationsService.send(
      'user',
      result.userId,
      '兼职申请未通过',
      `你的兼职申请未通过：${rejectReason}`,
      'runner-application',
      id,
    );

    const status = isRunnerApplyStatus(result.status) ? result.status : 'rejected';
    return {
      id: result.id,
      userId: result.userId,
      name: result.name,
      phone: result.phone,
      wechatId: result.wechatId,
      paymentQrUrl: (result as any).paymentQrUrl ?? '',
      status,
      rejectReason: result.rejectReason ?? '',
      reviewedBy: result.reviewedBy ?? '',
      reviewedAt: result.reviewedAt ? result.reviewedAt.toISOString() : null,
      createdAt: result.createdAt.toISOString(),
    };
  }

  // ========== 管理员通知列表 ==========
  async getNotifications(
    page = 1,
    pageSize = 20,
  ): Promise<NotificationListResponse> {
    return this.notificationsService.listByRecipient('admin', 'admin', page, pageSize);
  }

  async markAllNotificationsRead(): Promise<void> {
    await this.notificationsService.markAllRead('admin', 'admin');
  }

  async markNotificationRead(notifId: string): Promise<void> {
    await this.notificationsService.markOneRead(notifId, 'admin', 'admin');
  }

  // ========== helper：按 id 取完整退款记录 ==========
  private async getRefundById(id: string): Promise<RefundRequest> {
    const { items } = await this.getRefundList();
    const found = items.find((r) => r.id === id);
    if (!found) throw new NotFoundException('退款记录不存在');
    return found;
  }
}
