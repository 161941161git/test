import {
  Injectable,
  Inject,
  Logger,
  BadRequestException,
  NotFoundException,
  ConflictException,
  forwardRef,
} from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@server/database/database.module';
import { eq, desc, sql, and, count, gte } from 'drizzle-orm';
import { withdrawRequests, users } from '@server/database/schema';
import type {
  WithdrawRequest,
  WithdrawStatus,
  PayChannel,
} from '@shared/api.interface';
import { WITHDRAW_STATUSES } from '@shared/api.interface';
import { NotificationsService } from '../notifications/notifications.service';

function formatAmount(value: string | number): string {
  const num = typeof value === 'string' ? Number(value) : value;
  return num.toFixed(2);
}

function mapWithdrawRow(
  row: {
    id: string;
    userId: string;
    userName: string | null;
    userPhone: string | null;
    amount: string;
    status: string;
    wechatId: string | null;
    channel: string;
    payAccountNo: string | null;
    realName: string | null;
    payQrUrl: string | null;
    reviewedBy: string | null;
    reviewedAt: Date | null;
    paidAt: Date | null;
    failReason: string | null;
    createdAt: Date;
  },
): WithdrawRequest {
  return {
    id: row.id,
    userId: row.userId,
    userName: row.userName ?? '',
    userPhone: row.userPhone ?? '',
    amount: formatAmount(row.amount),
    status: row.status as WithdrawStatus,
    wechatId: row.wechatId ?? '',
    channel: row.channel as PayChannel,
    payAccountNo: row.payAccountNo,
    realName: row.realName,
    payQrUrl: row.payQrUrl ?? '',
    reviewedBy: row.reviewedBy ?? '',
    reviewedAt: row.reviewedAt ? row.reviewedAt.toISOString() : null,
    paidAt: row.paidAt ? row.paidAt.toISOString() : null,
    failReason: row.failReason,
    createdAt: row.createdAt.toISOString(),
  };
}

@Injectable()
export class WithdrawService {
  private readonly logger = new Logger(WithdrawService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
    @Inject(forwardRef(() => NotificationsService))
    private readonly notificationsService: NotificationsService,
  ) {}

  async applyWithdraw(
    userId: string,
    amountStr: string,
    channel: PayChannel = 'wechat_qr',
  ): Promise<WithdrawRequest> {
    try {
      const amount = Number(amountStr);
      if (isNaN(amount) || amount <= 0) {
        throw new BadRequestException('提现金额必须大于 0');
      }

      const result = await this.db.transaction(async (tx) => {
        // 查找用户并加行锁，防止并发超提
        const userRows = await tx
          .select()
          .from(users)
          .where(eq(users.id, userId))
          .limit(1)
          .for('update');

        if (userRows.length === 0) {
          throw new NotFoundException('用户不存在');
        }

        const user = userRows[0];
        const totalEarnings = Number(user.totalEarnings);

        // 可提现余额 = totalEarnings（已结算收入）
        if (totalEarnings < amount) {
          throw new ConflictException('可提现余额不足');
        }

        // 根据渠道获取对应收款码 URL
        let payQrUrl = '';
        if (channel === 'wechat_qr') {
          payQrUrl = user.wechatQrUrl ?? '';
          if (!payQrUrl) {
            throw new BadRequestException('请先设置微信收款码');
          }
        } else if (channel === 'alipay_qr') {
          payQrUrl = user.alipayQrUrl ?? '';
          if (!payQrUrl) {
            throw new BadRequestException('请先设置支付宝收款码');
          }
        } else {
          throw new BadRequestException('不支持的提现渠道');
        }

        // 插入提现记录（线下模式：申请时不扣余额）
        const inserted = await tx
          .insert(withdrawRequests)
          .values({
            userId,
            amount: formatAmount(amount),
            status: 'pending',
            wechatId: user.wechatId ?? '',
            channel,
            payAccountNo: null,
            realName: null,
            payQrUrl,
          })
          .returning();

        if (inserted.length === 0) {
          throw new BadRequestException('提现申请失败');
        }

        return {
          request: inserted[0],
          userName: user.name,
          userPhone: user.phone,
        };
      });

      // 通知管理员：新提现申请
      void this.notificationsService.send(
        'admin',
        'admin',
        '新提现申请',
        `用户 ${result.userName} 申请提现 ¥${formatAmount(result.request.amount)}`,
        'withdraw',
        result.request.id,
      );

      return mapWithdrawRow({
        id: result.request.id,
        userId: result.request.userId,
        userName: result.userName,
        userPhone: result.userPhone,
        amount: result.request.amount,
        status: result.request.status,
        wechatId: result.request.wechatId,
        channel: result.request.channel,
        payAccountNo: result.request.payAccountNo,
        realName: result.request.realName,
        payQrUrl: result.request.payQrUrl,
        reviewedBy: result.request.reviewedBy,
        reviewedAt: result.request.reviewedAt,
        paidAt: result.request.paidAt,
        failReason: result.request.failReason,
        createdAt: result.request.createdAt,
      });
    } catch (error) {
      this.logger.error('提现申请失败', error);
      throw error;
    }
  }

  async getMyWithdraws(userId: string): Promise<{ items: WithdrawRequest[]; total: number }> {
    try {
      const [listResult, countResult] = await Promise.all([
        this.db
          .select({
            id: withdrawRequests.id,
            userId: withdrawRequests.userId,
            userName: users.name,
            userPhone: users.phone,
            amount: withdrawRequests.amount,
            status: withdrawRequests.status,
            wechatId: withdrawRequests.wechatId,
            channel: withdrawRequests.channel,
            payAccountNo: withdrawRequests.payAccountNo,
            realName: withdrawRequests.realName,
            payQrUrl: withdrawRequests.payQrUrl,
            reviewedBy: withdrawRequests.reviewedBy,
            reviewedAt: withdrawRequests.reviewedAt,
            paidAt: withdrawRequests.paidAt,
            failReason: withdrawRequests.failReason,
            createdAt: withdrawRequests.createdAt,
          })
          .from(withdrawRequests)
          .leftJoin(users, eq(withdrawRequests.userId, users.id))
          .where(eq(withdrawRequests.userId, userId))
          .orderBy(desc(withdrawRequests.createdAt)),
        this.db
          .select({ count: count() })
          .from(withdrawRequests)
          .where(eq(withdrawRequests.userId, userId)),
      ]);

      const items = listResult.map((row) => mapWithdrawRow({
        id: row.id,
        userId: row.userId,
        userName: row.userName,
        userPhone: row.userPhone,
        amount: row.amount,
        status: row.status,
        wechatId: row.wechatId,
        channel: row.channel,
        payAccountNo: row.payAccountNo,
        realName: row.realName,
        payQrUrl: row.payQrUrl,
        reviewedBy: row.reviewedBy,
        reviewedAt: row.reviewedAt,
        paidAt: row.paidAt,
        failReason: row.failReason,
        createdAt: row.createdAt,
      }));

      const total = Number(countResult[0]?.count ?? 0);

      return { items, total };
    } catch (error) {
      this.logger.error('获取我的提现记录失败', error);
      throw error;
    }
  }

  async getWithdrawList(status?: string): Promise<{ items: WithdrawRequest[]; total: number }> {
    try {
      const conditions = [];
      if (status && (WITHDRAW_STATUSES as readonly string[]).includes(status)) {
        conditions.push(eq(withdrawRequests.status, status));
      }

      const whereClause = conditions.length > 0
        ? and(...conditions)
        : undefined;

      const listQuery = this.db
        .select({
          id: withdrawRequests.id,
          userId: withdrawRequests.userId,
          userName: users.name,
          userPhone: users.phone,
          amount: withdrawRequests.amount,
          status: withdrawRequests.status,
          wechatId: withdrawRequests.wechatId,
          channel: withdrawRequests.channel,
          payAccountNo: withdrawRequests.payAccountNo,
          realName: withdrawRequests.realName,
          reviewedBy: withdrawRequests.reviewedBy,
          reviewedAt: withdrawRequests.reviewedAt,
          paidAt: withdrawRequests.paidAt,
          failReason: withdrawRequests.failReason,
          createdAt: withdrawRequests.createdAt,
        })
        .from(withdrawRequests)
        .leftJoin(users, eq(withdrawRequests.userId, users.id))
        .orderBy(desc(withdrawRequests.createdAt));

      const countQuery = this.db
        .select({ count: count() })
        .from(withdrawRequests);

      const [listResult, countResult] = await Promise.all([
        whereClause ? listQuery.where(whereClause) : listQuery,
        whereClause ? countQuery.where(whereClause) : countQuery,
      ]);

      const items = listResult.map((row) => mapWithdrawRow({
        id: row.id,
        userId: row.userId,
        userName: row.userName,
        userPhone: row.userPhone,
        amount: row.amount,
        status: row.status,
        wechatId: row.wechatId,
        channel: row.channel,
        payAccountNo: row.payAccountNo,
        realName: row.realName,
        payQrUrl: null,
        reviewedBy: row.reviewedBy,
        reviewedAt: row.reviewedAt,
        paidAt: row.paidAt,
        failReason: row.failReason,
        createdAt: row.createdAt,
      }));

      const total = Number(countResult[0]?.count ?? 0);

      return { items, total };
    } catch (error) {
      this.logger.error('获取提现列表失败', error);
      throw error;
    }
  }

  async markPaid(id: string, adminName: string): Promise<WithdrawRequest> {
    try {
      const result = await this.db.transaction(async (tx) => {
        // 先查状态并加锁
        const existing = await tx
          .select()
          .from(withdrawRequests)
          .where(eq(withdrawRequests.id, id))
          .limit(1)
          .for('update');

        if (existing.length === 0) {
          throw new NotFoundException('提现记录不存在');
        }

        if (existing[0].status !== 'pending') {
          throw new BadRequestException('只有待审核的提现记录可以标记已打款');
        }

        const record = existing[0];
        const amount = Number(record.amount);

        // 从 totalEarnings 中扣除提现金额（线下模式：totalEarnings = 可提现余额）
        const updatedUsers = await tx
          .update(users)
          .set({
            totalEarnings: sql`${users.totalEarnings} - ${amount}::numeric`,
          })
          .where(and(
            eq(users.id, record.userId),
            gte(users.totalEarnings, sql`${amount}::numeric`),
          ))
          .returning({ id: users.id });

        if (updatedUsers.length === 0) {
          throw new ConflictException('可提现余额不足或用户不存在');
        }

        // 更新状态为 paid
        const updated = await tx
          .update(withdrawRequests)
          .set({
            status: 'paid',
            reviewedBy: adminName,
            reviewedAt: new Date(),
            paidAt: new Date(),
          })
          .where(and(
            eq(withdrawRequests.id, id),
            eq(withdrawRequests.status, 'pending'),
          ))
          .returning();

        if (updated.length === 0) {
          throw new BadRequestException('更新失败，状态已变更');
        }

        // 关联用户信息
        const userRows = await tx
          .select({ name: users.name, phone: users.phone })
          .from(users)
          .where(eq(users.id, record.userId))
          .limit(1);

        return {
          record: updated[0],
          userName: userRows[0]?.name ?? null,
          userPhone: userRows[0]?.phone ?? null,
        };
      });

      // 通知用户：提现已打款
      void this.notificationsService.send(
        'user',
        result.record.userId,
        '提现已打款',
        `你的 ¥${formatAmount(result.record.amount)} 提现已打款，请查收`,
        'withdraw',
        id,
      );

      return mapWithdrawRow({
        id: result.record.id,
        userId: result.record.userId,
        userName: result.userName,
        userPhone: result.userPhone,
        amount: result.record.amount,
        status: result.record.status,
        wechatId: result.record.wechatId,
        channel: result.record.channel,
        payAccountNo: result.record.payAccountNo,
        realName: result.record.realName,
        payQrUrl: result.record.payQrUrl,
        reviewedBy: result.record.reviewedBy,
        reviewedAt: result.record.reviewedAt,
        paidAt: result.record.paidAt,
        failReason: result.record.failReason,
        createdAt: result.record.createdAt,
      });
    } catch (error) {
      this.logger.error('标记已打款失败', error);
      throw error;
    }
  }

  async rejectWithdraw(
    id: string,
    adminName: string,
    failReason: string,
  ): Promise<WithdrawRequest> {
    try {
      // 先查状态
      const existing = await this.db
        .select()
        .from(withdrawRequests)
        .where(eq(withdrawRequests.id, id))
        .limit(1);

      if (existing.length === 0) {
        throw new NotFoundException('提现记录不存在');
      }

      if (existing[0].status !== 'pending') {
        throw new BadRequestException('只有待审核的提现记录可以拒绝');
      }

      // 线下模式：拒绝时不退回余额，只更新状态和失败原因
      const updated = await this.db
        .update(withdrawRequests)
        .set({
          status: 'failed',
          reviewedBy: adminName,
          reviewedAt: new Date(),
          failReason,
        })
        .where(and(
          eq(withdrawRequests.id, id),
          eq(withdrawRequests.status, 'pending'),
        ))
        .returning();

      if (updated.length === 0) {
        throw new BadRequestException('更新失败，状态已变更');
      }

      const record = updated[0];

      // 关联用户信息
      const userRows = await this.db
        .select({ name: users.name, phone: users.phone })
        .from(users)
        .where(eq(users.id, record.userId))
        .limit(1);

      // 通知用户：提现被拒绝
      void this.notificationsService.send(
        'user',
        record.userId,
        '提现被拒绝',
        `你的 ¥${formatAmount(record.amount)} 提现申请未通过：${failReason}`,
        'withdraw',
        id,
      );

      return mapWithdrawRow({
        id: record.id,
        userId: record.userId,
        userName: userRows[0]?.name ?? null,
        userPhone: userRows[0]?.phone ?? null,
        amount: record.amount,
        status: record.status,
        wechatId: record.wechatId,
        channel: record.channel,
        payAccountNo: record.payAccountNo,
        realName: record.realName,
        payQrUrl: record.payQrUrl,
        reviewedBy: record.reviewedBy,
        reviewedAt: record.reviewedAt,
        paidAt: record.paidAt,
        failReason: record.failReason,
        createdAt: record.createdAt,
      });
    } catch (error) {
      this.logger.error('拒绝提现失败', error);
      throw error;
    }
  }
}
