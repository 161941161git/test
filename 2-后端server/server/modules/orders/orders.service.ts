import { BadRequestException, ForbiddenException, forwardRef, Inject, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@server/database/database.module';
import { eq, and, desc, inArray, sql, count, isNull } from 'drizzle-orm';

import { orders, orderPackages, users, admins, refundRequests, chatMessages, fundTransactions, settlementSessions, refundSessions, refundMessages } from '@server/database/schema';
import { PaymentService } from '@server/modules/payment/payment.service';
import { SettlementService } from '@server/modules/settlement/settlement.service';
import { NotificationsService } from '@server/modules/notifications/notifications.service';
import type {
  Order,
  Package,
  FeeDetail,
  OrderListResponse,
  CreateOrderRequest,
  OrderStatus,
  PaymentStatus,
  PackageSize,
} from '@shared/api.interface';
import { isOrderStatus, PAYMENT_STATUSES, PAY_CHANNELS, FUND_TX_TYPES, FUND_TX_STATUSES } from '@shared/api.interface';

@Injectable()
export class OrdersService implements OnModuleInit {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
    private readonly paymentService: PaymentService,
    private readonly settlementService: SettlementService,
    @Inject(forwardRef(() => NotificationsService))
    private readonly notificationsService: NotificationsService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.startAutoSettleTimer();
  }

  private startAutoSettleTimer(): void {
    // 每小时检查一次
    setInterval(() => {
      void this.autoSettleExpiredOrders().catch((err) => {
        this.logger.error('自动结算失败', err);
      });
    }, 60 * 60 * 1000);
    // 启动 1 分钟后先跑一次
    setTimeout(() => {
      void this.autoSettleExpiredOrders().catch((err) => {
        this.logger.error('首次自动结算失败', err);
      });
    }, 60 * 1000);
  }

  /** 计算费用 */
  calculateFee(packageCount: number, isRainy: boolean, isUrgent: boolean): FeeDetail {
    const baseFee = 1.0;
    const extraFee = packageCount > 2 ? (packageCount - 2) * 0.5 : 0;
    const rainyFee = isRainy ? 0.5 : 0;
    const urgentFee = isUrgent ? 0.5 : 0;
    const total = baseFee + extraFee + rainyFee + urgentFee;
    return {
      baseFee: baseFee.toFixed(2),
      extraFee: extraFee.toFixed(2),
      rainyFee: rainyFee.toFixed(2),
      urgentFee: urgentFee.toFixed(2),
      total: total.toFixed(2),
    };
  }

  /** 创建订单 */
  async createOrder(dto: CreateOrderRequest): Promise<Order> {
    const fee = this.calculateFee(dto.packages.length, dto.isRainy, dto.isUrgent);
    const orderNo = `SD${Date.now()}${Math.floor(Math.random() * 900 + 100)}`;

    const result = await this.db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(orders)
        .values({
          orderNo,
          buyerId: dto.buyerId,
          status: 'pending',
          paymentStatus: 'unpaid',
          totalAmount: fee.total,
          baseFee: fee.baseFee,
          extraFee: fee.extraFee,
          rainyFee: fee.rainyFee,
          urgentFee: fee.urgentFee,
          isRainy: dto.isRainy,
          isUrgent: dto.isUrgent,
          packageCount: dto.packages.length,
          dormitory: dto.dormitory,
          contactPhone: dto.contactPhone,
          remark: dto.remark,
          payProofUrl: '',
          payRemark: '',
        })
        .returning();

      const packageValues = dto.packages.map((pkg) => ({
        orderId: inserted.id,
        trackingNo: pkg.trackingNo,
        pickupPhone: pkg.pickupPhone,
        size: pkg.size,
      }));

      const insertedPackages = await tx
        .insert(orderPackages)
        .values(packageValues)
        .returning();

      return { order: inserted, packages: insertedPackages };
    });

    const buyer = await this.db
      .select({ name: users.name, phone: users.phone })
      .from(users)
      .where(eq(users.id, dto.buyerId))
      .limit(1);

    if (buyer.length === 0) {
      throw new NotFoundException('买家不存在');
    }

    return this.mapToOrderDto(result.order, result.packages, buyer[0].name, buyer[0].phone, null, null);
  }

  /** 订单列表 */
  async getOrderList(params: {
    status?: OrderStatus;
    paymentStatus?: PaymentStatus;
    buyerId?: string;
    runnerId?: string;
    excludeBuyerId?: string;
    page?: number;
    pageSize?: number;
  }): Promise<OrderListResponse> {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;
    const offset = (page - 1) * pageSize;

    const conditions = [];
    if (params.status) conditions.push(eq(orders.status, params.status));
    if (params.buyerId) conditions.push(eq(orders.buyerId, params.buyerId));
    if (params.runnerId) conditions.push(eq(orders.runnerId, params.runnerId));
    if (params.excludeBuyerId) conditions.push(sql`${orders.buyerId} <> ${params.excludeBuyerId}`);

    // 支付状态过滤：接单大厅（无 buyerId/runnerId）默认返回待核对或已支付订单
    if (params.paymentStatus) {
      conditions.push(eq(orders.paymentStatus, params.paymentStatus));
    } else if (!params.buyerId && !params.runnerId) {
      conditions.push(inArray(orders.paymentStatus, ['pending_verify', 'paid']));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult] = await this.db
      .select({ count: count() })
      .from(orders)
      .where(whereClause);

    const orderRows = await this.db
      .select()
      .from(orders)
      .where(whereClause)
      .orderBy(desc(orders.createdAt))
      .limit(pageSize)
      .offset(offset);

    if (orderRows.length === 0) {
      return { items: [], total: Number(countResult.count) };
    }

    // 批量查 packages
    const orderIds = orderRows.map((o) => o.id);
    const allPackages = await this.db
      .select()
      .from(orderPackages)
      .where(inArray(orderPackages.orderId, orderIds));

    const packagesByOrder = new Map<string, typeof orderPackages.$inferSelect[]>();
    for (const pkg of allPackages) {
      const arr = packagesByOrder.get(pkg.orderId) ?? [];
      arr.push(pkg);
      packagesByOrder.set(pkg.orderId, arr);
    }

    // 批量查用户
    const buyerIds = [...new Set(orderRows.map((o) => o.buyerId))];
    const runnerIds = [...new Set(orderRows.filter((o) => o.runnerId).map((o) => o.runnerId as string))];
    const allUserIds = [...new Set([...buyerIds, ...runnerIds])];

    const allUsers = await this.db
      .select({ id: users.id, name: users.name, phone: users.phone })
      .from(users)
      .where(inArray(users.id, allUserIds));

    const userMap = new Map<string, { name: string; phone: string }>();
    for (const u of allUsers) {
      userMap.set(u.id, { name: u.name, phone: u.phone });
    }

    const items: Order[] = orderRows.map((order) => {
      const buyerInfo = userMap.get(order.buyerId);
      const runnerInfo = order.runnerId ? userMap.get(order.runnerId) : undefined;
      const pkgs = packagesByOrder.get(order.id) ?? [];
      return this.mapToOrderDto(
        order,
        pkgs,
        buyerInfo?.name ?? '',
        buyerInfo?.phone ?? '',
        runnerInfo?.name ?? null,
        runnerInfo?.phone ?? null,
      );
    });

    return { items, total: Number(countResult.count) };
  }

  /** 订单详情 */
  async getOrderDetail(id: string): Promise<Order> {
    const orderRows = await this.db
      .select()
      .from(orders)
      .where(eq(orders.id, id))
      .limit(1);

    if (orderRows.length === 0) {
      throw new NotFoundException('订单不存在');
    }

    const order = orderRows[0];

    const pkgs = await this.db
      .select()
      .from(orderPackages)
      .where(eq(orderPackages.orderId, id));

    const buyerRows = await this.db
      .select({ name: users.name, phone: users.phone })
      .from(users)
      .where(eq(users.id, order.buyerId))
      .limit(1);

    let runnerName: string | null = null;
    let runnerPhone: string | null = null;

    if (order.runnerId) {
      const runnerRows = await this.db
        .select({ name: users.name, phone: users.phone })
        .from(users)
        .where(eq(users.id, order.runnerId))
        .limit(1);
      if (runnerRows.length > 0) {
        runnerName = runnerRows[0].name;
        runnerPhone = runnerRows[0].phone;
      }
    }

    const buyer = buyerRows[0];

    // 查询结算会话
    const sessionRows = await this.db
      .select({ id: settlementSessions.id })
      .from(settlementSessions)
      .where(eq(settlementSessions.orderId, id))
      .limit(1);
    const settlementSessionId = sessionRows.length > 0 ? sessionRows[0].id : null;

    return this.mapToOrderDto(
      order,
      pkgs,
      buyer?.name ?? '',
      buyer?.phone ?? '',
      runnerName,
      runnerPhone,
      settlementSessionId,
    );
  }

  /** 接单 */
  async acceptOrder(id: string, runnerId: string): Promise<Order> {
    // 检查跑腿员身份（必须是已审核通过的）
    const runnerRows = await this.db
      .select({ isRunner: users.isRunner, userRole: users.userRole, name: users.name, phone: users.phone })
      .from(users)
      .where(eq(users.id, runnerId))
      .limit(1);

    if (runnerRows.length === 0) {
      throw new NotFoundException('跑腿员不存在');
    }

    if (!runnerRows[0].isRunner || runnerRows[0].userRole !== 'runner') {
      throw new ForbiddenException('兼职申请审核通过后才能接单');
    }

    // 先检查订单支付状态
    const existingOrder = await this.db.select().from(orders).where(eq(orders.id, id)).limit(1);
    if (existingOrder.length === 0) {
      throw new NotFoundException('订单不存在');
    }

    // 校验：不能接自己发布的订单
    if (existingOrder[0].buyerId === runnerId) {
      throw new BadRequestException('不能接自己发布的订单');
    }

    if (existingOrder[0].paymentStatus !== 'paid' && existingOrder[0].paymentStatus !== 'pending_verify') {
      throw new BadRequestException('订单尚未支付，无法接单');
    }

    const updated = await this.db
      .update(orders)
      .set({
        status: 'in_progress',
        runnerId,
      })
      .where(and(eq(orders.id, id), eq(orders.status, 'pending'), isNull(orders.runnerId)))
      .returning();

    if (updated.length === 0) {
      throw new BadRequestException('该订单已被接走');
    }

    const order = updated[0];
    const pkgs = await this.db.select().from(orderPackages).where(eq(orderPackages.orderId, id));

    const buyerRows = await this.db
      .select({ name: users.name, phone: users.phone })
      .from(users)
      .where(eq(users.id, order.buyerId))
      .limit(1);

    const runnerName = runnerRows[0].name;

    // 通知买家：订单已被接单
    void this.notificationsService.send(
      'user',
      order.buyerId,
      '订单已被接单',
      `${runnerName} 已接单，正在为你取件`,
      'order',
      order.id,
    );

    // 通知管理员：订单已被接单
    void this.notificationsService.send(
      'admin',
      'admin',
      '订单已被接单',
      `订单 ${order.orderNo} 已被 ${runnerName} 接单`,
      'order',
      order.id,
    );

    return this.mapToOrderDto(
      order,
      pkgs,
      buyerRows[0]?.name ?? '',
      buyerRows[0]?.phone ?? '',
      runnerRows[0].name,
      runnerRows[0].phone,
    );
  }

  /** 标记送达 */
  async deliverOrder(id: string, runnerId: string): Promise<{ order: Order; settlementSessionId: string }> {
    const orderRows = await this.db.select().from(orders).where(eq(orders.id, id)).limit(1);
    if (orderRows.length === 0) {
      throw new NotFoundException('订单不存在');
    }

    const order = orderRows[0];

    if (order.status !== 'in_progress') {
      throw new BadRequestException('订单状态不允许标记送达');
    }

    if (order.runnerId !== runnerId) {
      throw new BadRequestException('该订单不是此跑腿员接的');
    }

    // 检查是否有送达照片
    const [photoCount] = await this.db
      .select({ count: count() })
      .from(chatMessages)
      .where(and(
        eq(chatMessages.orderId, id),
        eq(chatMessages.isDeliveryPhoto, true),
      ));

    if (Number(photoCount.count) === 0) {
      throw new BadRequestException('请先拍照发送给买家');
    }

    const deliveredAt = new Date();
    const autoSettleAt = new Date(deliveredAt.getTime() + 24 * 60 * 60 * 1000);

    const updated = await this.db
      .update(orders)
      .set({
        status: 'delivered',
        deliveredAt,
        autoSettleAt,
      })
      .where(eq(orders.id, id))
      .returning();

    if (updated.length === 0) {
      throw new NotFoundException('订单不存在');
    }

    // 通知买家：快递已送达
    void this.notificationsService.send(
      'user',
      order.buyerId,
      '快递已送达',
      `你的快递已送达，放在 ${order.dormitory} 门口，请确认收货`,
      'order',
      id,
    );

    // 创建结算会话
    const settlementSessionId = await this.settlementService.createSession(id);

    // 通知管理员：订单已送达（带结算会话ID，方便查看收款码和标记打款）
    void this.notificationsService.send(
      'admin',
      'admin',
      `订单 ${order.orderNo} 已送达，待付款`,
      `订单 ${order.orderNo} 已送达，请核对后付款给跑腿员`,
      'settlement',
      settlementSessionId,
    );

    const detail = await this.getOrderDetail(id);
    return { order: detail, settlementSessionId };
  }

  /** 确认收货并结算 */
  async confirmOrder(id: string, buyerId: string): Promise<Order> {
    const orderRows = await this.db.select().from(orders).where(eq(orders.id, id)).limit(1);
    if (orderRows.length === 0) {
      throw new NotFoundException('订单不存在');
    }

    const order = orderRows[0];

    if (order.status !== 'delivered') {
      throw new BadRequestException('订单状态不允许确认收货');
    }

    if (order.buyerId !== buyerId) {
      throw new BadRequestException('只有买家可以确认收货');
    }

    await this.settleOrder(id);

    // 标记结算会话为待打款
    const sessionRows = await this.db
      .select({ id: settlementSessions.id })
      .from(settlementSessions)
      .where(eq(settlementSessions.orderId, id))
      .limit(1);
    if (sessionRows.length > 0) {
      await this.settlementService.markOrderPaid(sessionRows[0].id);
    }

    // 通知跑腿员：订单已完成
    if (order.runnerId) {
      void this.notificationsService.send(
        'user',
        order.runnerId,
        '订单已完成',
        `订单已完成，本单可得 ¥${Number(order.runnerEarnings).toFixed(2)}`,
        'order',
        id,
      );
    }

    // 通知管理员：订单已完成
    void this.notificationsService.send(
      'admin',
      'admin',
      '订单已完成',
      `订单 ${order.orderNo} 已完成，平台手续费 ¥${Number(order.platformFee).toFixed(2)} 已入账`,
      'order',
      id,
    );

    return this.getOrderDetail(id);
  }

  /** 执行结算逻辑（内部方法，供 confirmOrder / forceComplete / autoSettle 复用）
   * 更新订单状态 + 跑腿员余额+90% + 平台收益+10% + 写结算流水
   * 所有操作在同一事务中，保持一致性
   */
  private async settleOrder(orderId: string): Promise<void> {
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

      // 幂等：已完成的跳过
      if (order.status === 'completed') {
        return;
      }

      if (!order.runnerId) {
        throw new BadRequestException('订单没有跑腿员，无法结算');
      }

      const totalAmountNum = Number(order.totalAmount);
      const runnerEarnings = (totalAmountNum * 0.9).toFixed(2);
      const platformFee = (totalAmountNum * 0.1).toFixed(2);
      const totalAmountFen = Math.round(totalAmountNum * 100);

      // 1. 更新订单状态和结算字段
      const confirmedAt = new Date();
      const updated = await tx
        .update(orders)
        .set({
          status: 'completed',
          confirmedAt,
          runnerEarnings,
          platformFee,
        })
        .where(eq(orders.id, orderId))
        .returning();

      if (updated.length === 0) {
        throw new BadRequestException('订单更新失败');
      }

      // 2. 增加跑腿员余额和总收益
      await tx
        .update(users)
        .set({
          balance: sql`${users.balance} + ${runnerEarnings}::numeric`,
          totalEarnings: sql`${users.totalEarnings} + ${runnerEarnings}::numeric`,
          totalOrders: sql`${users.totalOrders} + 1`,
        })
        .where(eq(users.id, order.runnerId));

      // 3. 增加平台收益
      const adminRow = (await tx.select().from(admins).limit(1))[0];
      if (adminRow) {
        await tx
          .update(admins)
          .set({
            platformEarnings: sql`${admins.platformEarnings} + ${platformFee}::numeric`,
          })
          .where(eq(admins.id, adminRow.id));
      }

      // 4. 写 settlement_pay 类型资金流水（从托管转出，总金额）
      await tx.insert(fundTransactions).values({
        orderId,
        txType: 'settlement_pay',
        amountFen: totalAmountFen,
        direction: 'out',
        channel: 'offline',
        status: 'success',
        runnerId: order.runnerId,
        remark: `订单结算打款，订单号：${order.orderNo}，跑腿费 ¥${runnerEarnings}（90%），平台手续费 ¥${platformFee}（10%）`,
      });

      // 5. 写 settlement_settle 类型流水（标记分账拆分）
      await tx.insert(fundTransactions).values({
        orderId,
        txType: 'settlement_settle',
        amountFen: totalAmountFen,
        direction: 'out',
        channel: 'offline',
        status: 'success',
        runnerId: order.runnerId,
        adminId: adminRow?.id ?? null,
        remark: `结算分账：跑腿员 ¥${runnerEarnings}（90%），平台 ¥${platformFee}（10%）`,
      });

      // 6. 更新结算会话的金额（送达时创建的会话金额为 0，结算时回填正确金额）
      const runnerAmountFen = Math.round(Number(runnerEarnings) * 100);
      const platformFeeFenVal = Math.round(Number(platformFee) * 100);
      await tx
        .update(settlementSessions)
        .set({
          totalAmountFen,
          runnerAmountFen,
          platformFeeFen: platformFeeFenVal,
        })
        .where(eq(settlementSessions.orderId, orderId));
    });
  }

  /** 自动结算：送达超过 24 小时且状态为 delivered 的订单自动确认收货 */
  async autoSettleExpiredOrders(): Promise<{ count: number }> {
    const now = new Date();
    const expiredOrders = await this.db
      .select({ id: orders.id })
      .from(orders)
      .where(and(
        eq(orders.status, 'delivered'),
        sql`${orders.autoSettleAt} <= ${now.toISOString()}::timestamptz`,
      ));

    if (expiredOrders.length === 0) {
      return { count: 0 };
    }

    let settledCount = 0;
    for (const order of expiredOrders) {
      try {
        // 先结算（更新订单状态+加余额+写流水，内部事务保证一致）
        await this.settleOrder(order.id);

        // 创建结算会话并标记为待打款
        const sessionId = await this.settlementService.createSession(order.id);
        await this.settlementService.markOrderPaid(sessionId);

        settledCount += 1;
        this.logger.log(`自动结算订单成功：${order.id}`);
      } catch (err) {
        this.logger.error(`自动结算订单失败：${order.id}`, err);
      }
    }

    return { count: settledCount };
  }

  /** 申请退款 */
  async applyRefund(id: string, buyerId: string, reason: string, screenshotUrl?: string): Promise<{ order: Order; refund: typeof refundRequests.$inferSelect; sessionId: string }> {
    const orderRows = await this.db.select().from(orders).where(eq(orders.id, id)).limit(1);
    if (orderRows.length === 0) {
      throw new NotFoundException('订单不存在');
    }

    const order = orderRows[0];

    if (order.buyerId !== buyerId) {
      throw new BadRequestException('只有买家可以申请退款');
    }

    if (order.status === 'refunding' || order.status === 'refunded') {
      throw new BadRequestException('订单已在退款中或已退款');
    }

    const refundAmountYuan = Number(order.totalAmount).toFixed(2);

    let sessionId = '';
    const result = await this.db.transaction(async (tx) => {
      const updatedOrderRows = await tx
        .update(orders)
        .set({ status: 'refunding' })
        .where(eq(orders.id, id))
        .returning();

      if (updatedOrderRows.length === 0) {
        throw new BadRequestException('订单状态更新失败');
      }

      const [refund] = await tx
        .insert(refundRequests)
        .values({
          orderId: id,
          buyerId,
          reason,
          status: 'pending',
          rejectReason: '',
          reviewedBy: '',
          screenshotUrl: screenshotUrl ?? null,
        })
        .returning();

      // 创建退款会话
      const [session] = await tx
        .insert(refundSessions)
        .values({
          orderId: id,
          buyerId,
          refundRequestId: refund.id,
          status: 'pending',
        })
        .returning();

      sessionId = session.id;

      return { order: updatedOrderRows[0], refund };
    });

    // 事务提交后：发系统消息 + 通知管理员
    if (sessionId) {
      const systemContent = `你的退款申请已提交（理由：${reason}），请把你的微信/支付宝收款码发到这里，平台核对后原路退回 ¥${refundAmountYuan}。`;
      await this.db.insert(refundMessages).values({
        sessionId,
        senderRole: 'system',
        senderId: null,
        msgType: 'text',
        content: systemContent,
        imageUrl: '',
        isSystem: true,
      });

      // 通知管理员
      void this.notificationsService.send(
        'admin',
        'admin',
        '新退款申请',
        `新退款申请 ¥${refundAmountYuan}，订单号 ${order.orderNo}`,
        'refund_session',
        sessionId,
      );
    }

    const orderDetail = await this.getOrderDetail(id);
    return { order: orderDetail, refund: result.refund, sessionId };
  }

  /** 管理员强制完成 */
  async forceComplete(id: string): Promise<Order> {
    const orderRows = await this.db.select().from(orders).where(eq(orders.id, id)).limit(1);
    if (orderRows.length === 0) {
      throw new NotFoundException('订单不存在');
    }

    const order = orderRows[0];
    if (order.status === 'completed') {
      return this.getOrderDetail(id);
    }

    // 如果还没送达，先设置送达时间
    if (!order.deliveredAt) {
      const deliveredAt = new Date();
      await this.db
        .update(orders)
        .set({ deliveredAt })
        .where(eq(orders.id, id));
    }

    await this.settleOrder(id);

    // 创建结算会话并标记为待打款
    const sessionId = await this.settlementService.createSession(id);
    await this.settlementService.markOrderPaid(sessionId);

    return this.getOrderDetail(id);
  }

  /** 买家标记已付款（待后台核对） */
  async markBuyerPaid(orderId: string, payProofUrl: string, payRemark: string): Promise<void> {
    const orderRows = await this.db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (orderRows.length === 0) {
      throw new NotFoundException('订单不存在');
    }

    const order = orderRows[0];
    if (order.paymentStatus === 'paid' || order.paymentStatus === 'pending_verify') {
      throw new BadRequestException('订单已标记付款');
    }

    const paidAt = new Date();
    const amountFen = Math.round(Number(order.totalAmount) * 100);

    await this.db.transaction(async (tx) => {
      // 更新订单支付状态为待核对
      await tx
        .update(orders)
        .set({
          paymentStatus: 'pending_verify',
          payChannel: 'wechat_qr',
          paidAt,
          payProofUrl: payProofUrl ?? '',
          payRemark: payRemark ?? '',
        })
        .where(eq(orders.id, orderId));

      // 写资金流水
      await tx.insert(fundTransactions).values({
        orderId,
        txType: 'buyer_payment',
        amountFen,
        direction: 'in',
        channel: 'wechat_qr',
        status: 'pending_verify',
        remark: '买家标记已付款（待核对）',
      });
    });

    // 通知管理员：新订单待接单
    void this.notificationsService.send(
      'admin',
      'admin',
      '新订单待接单',
      `新订单 ¥${Number(order.totalAmount).toFixed(2)}，宿舍 ${order.dormitory}，${order.packageCount} 个包裹，等待接单`,
      'order',
      orderId,
    );
  }

  /** 管理员取消订单（退款） */
  async cancelOrder(id: string): Promise<Order> {
    const orderRows = await this.db.select().from(orders).where(eq(orders.id, id)).limit(1);
    if (orderRows.length === 0) {
      throw new NotFoundException('订单不存在');
    }

    const order = orderRows[0];

    if (order.status === 'refunded') {
      return this.getOrderDetail(id);
    }

    // 更新订单状态为 refunded
    const updated = await this.db
      .update(orders)
      .set({ status: 'refunded' })
      .where(eq(orders.id, id))
      .returning();

    if (updated.length === 0) {
      throw new BadRequestException('订单取消失败');
    }

    // 标记结算会话为已退款
    await this.settlementService.markRefunded(id);

    return this.getOrderDetail(id);
  }

  // ========== 辅助方法 ==========

  private formatAmount(val: string | number): string {
    return Number(val).toFixed(2);
  }

  private mapToOrderDto(
    order: typeof orders.$inferSelect,
    pkgs: typeof orderPackages.$inferSelect[],
    buyerName: string,
    buyerPhone: string,
    runnerName: string | null,
    runnerPhone: string | null,
    settlementSessionId?: string | null,
  ): Order {
    const packages: Package[] = pkgs.map((p) => ({
      id: p.id,
      orderId: p.orderId,
      trackingNo: p.trackingNo,
      pickupPhone: p.pickupPhone,
      size: p.size as PackageSize,
    }));

    const status = isOrderStatus(order.status) ? order.status : 'pending' as OrderStatus;
    const isPaymentStatus = (v: string): v is PaymentStatus =>
      (PAYMENT_STATUSES as readonly string[]).includes(v);
    const paymentStatus = isPaymentStatus(order.paymentStatus) ? order.paymentStatus : 'unpaid' as PaymentStatus;

    return {
      id: order.id,
      orderNo: order.orderNo,
      buyerId: order.buyerId,
      buyerName,
      buyerPhone,
      runnerId: order.runnerId,
      runnerName,
      runnerPhone,
      status,
      totalAmount: this.formatAmount(order.totalAmount),
      baseFee: this.formatAmount(order.baseFee),
      extraFee: this.formatAmount(order.extraFee),
      rainyFee: this.formatAmount(order.rainyFee),
      urgentFee: this.formatAmount(order.urgentFee),
      isRainy: order.isRainy,
      isUrgent: order.isUrgent,
      packageCount: order.packageCount,
      dormitory: order.dormitory,
      contactPhone: order.contactPhone,
      remark: order.remark,
      runnerEarnings: this.formatAmount(order.runnerEarnings),
      platformFee: this.formatAmount(order.platformFee),
      paymentStatus,
      payChannel: (order.payChannel && PAY_CHANNELS.includes(order.payChannel as typeof PAY_CHANNELS[number])) ? (order.payChannel as typeof PAY_CHANNELS[number]) : null,
      thirdPartyTradeNo: order.thirdPartyTradeNo ?? null,
      paidAt: order.paidAt ? order.paidAt.toISOString() : null,
      deliveredAt: order.deliveredAt ? order.deliveredAt.toISOString() : null,
      confirmedAt: order.confirmedAt ? order.confirmedAt.toISOString() : null,
      autoSettleAt: order.autoSettleAt ? order.autoSettleAt.toISOString() : null,
      payProofUrl: order.payProofUrl ?? '',
      payRemark: order.payRemark ?? '',
      settlementSessionId: settlementSessionId ?? null,
      packages,
      createdAt: order.createdAt.toISOString(),
    };
  }
}
