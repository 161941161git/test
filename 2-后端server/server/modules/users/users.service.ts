import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@server/database/database.module';
import { count, eq, desc, and } from 'drizzle-orm';
import { users, runnerApplications } from '@server/database/schema';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import type { User, UserRole, RunnerApplication, RunnerApplyStatus } from '@shared/api.interface';
import { isUserRole, isRunnerApplyStatus } from '@shared/api.interface';
import type { ApplyRunnerDto } from './dto/apply-runner.dto';
import type { UpdateUserDto } from './dto/update-user.dto';
import type { UserListQueryDto } from './dto/user-list-query.dto';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
    @Inject(forwardRef(() => NotificationsService))
    private readonly notificationsService: NotificationsService,
  ) {}

  private toUser(row: typeof users.$inferSelect): User {
    const role = isUserRole(row.userRole) ? row.userRole : 'buyer';
    return {
      id: row.id,
      phone: row.phone,
      name: row.name,
      dormitory: row.dormitory,
      balance: Number(row.balance).toFixed(2),
      totalOrders: row.totalOrders,
      totalEarnings: Number(row.totalEarnings).toFixed(2),
      isRunner: row.isRunner,
      wechatId: row.wechatId ?? '',
      wechatQrUrl: row.wechatQrUrl ?? '',
      alipayQrUrl: row.alipayQrUrl ?? '',
      userRole: role,
      runnerStatus: row.isRunner ? 'approved' : 'none',
      createdAt: row.createdAt.toISOString(),
    };
  }

  private async enrichRunnerStatus(
    user: User,
  ): Promise<User> {
    if (user.isRunner) {
      return { ...user, runnerStatus: 'approved' };
    }
    const latest = await this.getLatestApplication(user.id);
    if (latest) {
      return { ...user, runnerStatus: latest.status };
    }
    return { ...user, runnerStatus: 'none' };
  }

  async findById(id: string): Promise<User> {
    const rows = await this.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (rows.length === 0) {
      throw new NotFoundException('用户不存在');
    }

    return this.enrichRunnerStatus(this.toUser(rows[0]));
  }

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    const patch: Partial<typeof users.$inferInsert> = {};

    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.dormitory !== undefined) patch.dormitory = dto.dormitory;

    if (dto.phone !== undefined) {
      // 检查新手机号是否已被其他用户占用
      const existing = await this.db
        .select()
        .from(users)
        .where(eq(users.phone, dto.phone))
        .limit(1);

      if (existing.length > 0 && existing[0].id !== id) {
        throw new ConflictException('该手机号已被使用');
      }

      patch.phone = dto.phone;
    }

    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('未提供可更新字段');
    }

    const updated = await this.db
      .update(users)
      .set(patch)
      .where(eq(users.id, id))
      .returning();

    if (updated.length === 0) {
      throw new NotFoundException('用户不存在');
    }

    return this.enrichRunnerStatus(this.toUser(updated[0]));
  }

  async getLatestApplication(userId: string): Promise<RunnerApplication | null> {
    const rows = await this.db
      .select()
      .from(runnerApplications)
      .where(eq(runnerApplications.userId, userId))
      .orderBy(desc(runnerApplications.createdAt))
      .limit(1);

    if (rows.length === 0) return null;

    const row = rows[0];
    const status = isRunnerApplyStatus(row.status)
      ? row.status
      : ('pending' as RunnerApplyStatus);

    return {
      id: row.id,
      userId: row.userId,
      name: row.name,
      phone: row.phone,
      wechatId: row.wechatId,
      paymentQrUrl: (row as any).paymentQrUrl ?? '',
      status,
      rejectReason: row.rejectReason ?? '',
      reviewedBy: row.reviewedBy ?? '',
      reviewedAt: row.reviewedAt ? row.reviewedAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async applyRunner(dto: ApplyRunnerDto): Promise<User> {
    const rows = await this.db
      .select()
      .from(users)
      .where(eq(users.id, dto.userId))
      .limit(1);

    if (rows.length === 0) {
      throw new NotFoundException('用户不存在');
    }

    const user = rows[0];

    // 如果已经是跑腿员，直接返回
    if (user.isRunner) {
      return this.enrichRunnerStatus(this.toUser(user));
    }

    const result = await this.db.transaction(async (tx) => {
      // 更新用户基本信息（name/phone/wechatId），但不改变 isRunner
      const updatedUser = await tx
        .update(users)
        .set({
          name: dto.name,
          phone: dto.phone,
          wechatId: dto.wechatId,
        })
        .where(eq(users.id, dto.userId))
        .returning();

      if (updatedUser.length === 0) {
        throw new NotFoundException('用户不存在');
      }

      // 检查是否有待审核的申请
      const existingPending = await tx
        .select()
        .from(runnerApplications)
        .where(and(
          eq(runnerApplications.userId, dto.userId),
          eq(runnerApplications.status, 'pending'),
        ))
        .limit(1);

      if (existingPending.length > 0) {
        return { user: updatedUser[0], application: existingPending[0] };
      }

      // 插入申请记录
      const [application] = await tx
        .insert(runnerApplications)
        .values({
          userId: dto.userId,
          name: dto.name,
          phone: dto.phone,
          wechatId: dto.wechatId,
          paymentQrUrl: dto.paymentQrUrl ?? '',
          status: 'pending',
        })
        .returning();

      return { user: updatedUser[0], application };
    });

    // 通知管理员有新申请
    void this.notificationsService.send(
      'admin',
      'admin',
      '新兼职申请',
      `用户 ${dto.name} 申请成为跑腿员，请及时审核`,
      'runner-application',
      result.application.id,
    );

    const userDto = this.toUser(result.user);
    // 返回时 runnerStatus=pending 因为刚提交申请
    return { ...userDto, runnerStatus: 'pending' as const };
  }

  async switchRole(id: string, role: UserRole): Promise<User> {
    const rows = await this.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (rows.length === 0) {
      throw new NotFoundException('用户不存在');
    }

    const user = rows[0];

    if (role === 'runner' && !user.isRunner) {
      throw new BadRequestException('您还不是跑腿员，请先申请');
    }

    const updated = await this.db
      .update(users)
      .set({ userRole: role })
      .where(eq(users.id, id))
      .returning();

    if (updated.length === 0) {
      throw new NotFoundException('用户不存在');
    }

    return this.enrichRunnerStatus(this.toUser(updated[0]));
  }

  async list(query: UserListQueryDto): Promise<{ items: User[]; total: number }> {
    const hasIsRunnerFilter = query.isRunner !== undefined;

    const baseSelect = this.db.select().from(users);
    const baseCount = this.db.select({ count: count() }).from(users);

    const listQuery = hasIsRunnerFilter
      ? baseSelect.where(eq(users.isRunner, query.isRunner as boolean))
      : baseSelect;
    const countQuery = hasIsRunnerFilter
      ? baseCount.where(eq(users.isRunner, query.isRunner as boolean))
      : baseCount;

    const [listResult, countResult] = await Promise.all([
      listQuery,
      countQuery,
    ]);

    const items: User[] = listResult.map((row) => this.toUser(row));
    const total = Number(countResult[0]?.count ?? 0);

    return { items, total };
  }

  async updateQrCodes(
    userId: string,
    wechatQrUrl: string,
    alipayQrUrl: string,
  ): Promise<User> {
    const updated = await this.db
      .update(users)
      .set({
        wechatQrUrl,
        alipayQrUrl,
      })
      .where(eq(users.id, userId))
      .returning();

    if (updated.length === 0) {
      throw new NotFoundException('用户不存在');
    }

    return this.enrichRunnerStatus(this.toUser(updated[0]));
  }

  async getQrCodes(
    userId: string,
  ): Promise<{ wechatQrUrl: string; alipayQrUrl: string }> {
    const rows = await this.db
      .select({
        wechatQrUrl: users.wechatQrUrl,
        alipayQrUrl: users.alipayQrUrl,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (rows.length === 0) {
      throw new NotFoundException('用户不存在');
    }

    return {
      wechatQrUrl: rows[0].wechatQrUrl ?? '',
      alipayQrUrl: rows[0].alipayQrUrl ?? '',
    };
  }
}
