import { Inject, Injectable, Logger } from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@server/database/database.module';
import { eq, desc } from 'drizzle-orm';
import { users, runnerApplications } from '@server/database/schema';
import { ConflictException, NotFoundException } from '@nestjs/common';
import type { User, AuthResponse, RunnerApplyStatus } from '@shared/api.interface';
import { isUserRole, isRunnerApplyStatus } from '@shared/api.interface';
import type { RegisterDto } from './dto/register.dto';
import type { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
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

  private async enrichRunnerStatus(user: User): Promise<User> {
    if (user.isRunner) {
      return { ...user, runnerStatus: 'approved' };
    }
    const latest = await this.db
      .select()
      .from(runnerApplications)
      .where(eq(runnerApplications.userId, user.id))
      .orderBy(desc(runnerApplications.createdAt))
      .limit(1);

    if (latest.length > 0 && isRunnerApplyStatus(latest[0].status)) {
      return { ...user, runnerStatus: latest[0].status as RunnerApplyStatus };
    }
    return { ...user, runnerStatus: 'none' };
  }

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const existing = await this.db
      .select()
      .from(users)
      .where(eq(users.phone, dto.phone))
      .limit(1);

    if (existing.length > 0) {
      throw new ConflictException('该手机号已注册');
    }

    const inserted = await this.db
      .insert(users)
      .values({
        phone: dto.phone,
        name: dto.name,
        dormitory: dto.dormitory,
        wechatQrUrl: '',
        alipayQrUrl: '',
      })
      .returning();

    const user = this.toUser(inserted[0]);
    const enriched = await this.enrichRunnerStatus(user);
    const token = user.id;

    return { user: enriched, token };
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const existing = await this.db
      .select()
      .from(users)
      .where(eq(users.phone, dto.phone))
      .limit(1);

    if (existing.length > 0) {
      const user = await this.enrichRunnerStatus(this.toUser(existing[0]));
      return { user, token: user.id };
    }

    // 不存在时，如果传了 name 和 dormitory，自动注册
    if (dto.name && dto.dormitory) {
      const inserted = await this.db
        .insert(users)
        .values({
          phone: dto.phone,
          name: dto.name,
          dormitory: dto.dormitory,
          wechatQrUrl: '',
          alipayQrUrl: '',
        })
        .returning();

      const user = await this.enrichRunnerStatus(this.toUser(inserted[0]));
      return { user, token: user.id };
    }

    throw new NotFoundException('用户不存在，请先注册');
  }
}
