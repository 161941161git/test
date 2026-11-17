import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@server/database/database.module';
import { eq, and, desc, count, sql } from 'drizzle-orm';

import { supportSessions, supportMessages, users } from '@server/database/schema';
import { NotificationsService } from '@server/modules/notifications/notifications.service';
import type {
  SupportSession,
  SupportMessage,
  SupportSessionType,
  SupportSessionStatus,
} from '@shared/api.interface';

@Injectable()
export class SupportService {
  private readonly logger = new Logger(SupportService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
    private readonly notificationsService: NotificationsService,
  ) {}

  private toSessionDto(row: typeof supportSessions.$inferSelect): SupportSession {
    return {
      id: row.id,
      sessionType: row.sessionType as SupportSessionType,
      userId: row.userId,
      userName: row.userName,
      lastMessage: row.lastMessage,
      lastMessageAt: row.lastMessageAt ? new Date(row.lastMessageAt).toISOString() : null,
      unreadAdminCount: row.unreadAdminCount,
      unreadUserCount: row.unreadUserCount,
      status: row.status as SupportSessionStatus,
      createdAt: new Date(row.createdAt).toISOString(),
    };
  }

  private toMessageDto(row: typeof supportMessages.$inferSelect): SupportMessage {
    return {
      id: row.id,
      sessionId: row.sessionId,
      senderRole: row.senderRole as 'user' | 'platform' | 'system',
      senderId: row.senderId ?? null,
      senderName: row.senderName,
      msgType: row.msgType as 'text' | 'image',
      content: row.content,
      imageUrl: row.imageUrl,
      isSystem: row.isSystem,
      relatedOrderId: row.relatedOrderId ?? null,
      createdAt: new Date(row.createdAt).toISOString(),
    };
  }

  async getOrCreateUserSession(
    userId: string,
    sessionType: SupportSessionType,
  ): Promise<SupportSession> {
    if (!userId) {
      throw new BadRequestException('用户ID不能为空');
    }
    if (sessionType !== 'buyer_platform' && sessionType !== 'runner_platform') {
      throw new BadRequestException('会话类型无效');
    }

    const existing = await this.db
      .select()
      .from(supportSessions)
      .where(and(
        eq(supportSessions.userId, userId),
        eq(supportSessions.sessionType, sessionType),
      ))
      .limit(1);

    if (existing.length > 0) {
      return this.toSessionDto(existing[0]);
    }

    // 查询用户姓名
    const userRows = await this.db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    const userName = userRows[0]?.name ?? '用户';

    const welcomeText = '你好，这里是顺手捎客服，请描述你的问题';
    const now = new Date();

    return await this.db.transaction(async (tx) => {
      const inserted = await tx
        .insert(supportSessions)
        .values({
          sessionType,
          userId,
          userName,
          lastMessage: welcomeText,
          lastMessageAt: now,
          unreadAdminCount: 0,
          unreadUserCount: 0,
          status: 'active',
        })
        .returning();

      const session = inserted[0];

      await tx.insert(supportMessages).values({
        sessionId: session.id,
        senderRole: 'system',
        senderId: null,
        senderName: '系统',
        msgType: 'text',
        content: welcomeText,
        imageUrl: '',
        isSystem: true,
      });

      return this.toSessionDto(session);
    });
  }

  private async verifyUserOwnership(sessionId: string, userId: string): Promise<void> {
    const sessionRows = await this.db
      .select({ userId: supportSessions.userId })
      .from(supportSessions)
      .where(eq(supportSessions.id, sessionId))
      .limit(1);
    if (sessionRows.length === 0) {
      throw new NotFoundException('会话不存在');
    }
    if (sessionRows[0].userId !== userId) {
      throw new ForbiddenException('无权访问该会话');
    }
  }

  async getMessagesByUser(sessionId: string, userId: string): Promise<SupportMessage[]> {
    // 一次查询同时完成「身份校验 + 清零未读」，省掉一次跨境外 DB 往返
    const sessionRows = await this.db
      .update(supportSessions)
      .set({ unreadUserCount: 0 })
      .where(and(eq(supportSessions.id, sessionId), eq(supportSessions.userId, userId)))
      .returning({ id: supportSessions.id });

    if (sessionRows.length === 0) {
      const exists = await this.db
        .select({ id: supportSessions.id })
        .from(supportSessions)
        .where(eq(supportSessions.id, sessionId))
        .limit(1);
      if (exists.length === 0) {
        throw new NotFoundException('会话不存在');
      }
      throw new ForbiddenException('无权访问该会话');
    }

    const rows = await this.db
      .select()
      .from(supportMessages)
      .where(eq(supportMessages.sessionId, sessionId))
      .orderBy(supportMessages.createdAt);

    return rows.map((row) => this.toMessageDto(row));
  }

  async sendUserMessage(
    sessionId: string,
    userId: string,
    msgType: 'text' | 'image',
    content: string,
    imageUrl: string,
  ): Promise<SupportMessage> {
    if (msgType === 'text' && !content?.trim()) {
      throw new BadRequestException('消息内容不能为空');
    }
    if (msgType === 'image' && !imageUrl) {
      throw new BadRequestException('图片不能为空');
    }

    // 一次查询同时拿到「归属人 + 会话状态」，替代原来的两次往返
    const sessionRows = await this.db
      .select({
        userId: supportSessions.userId,
        userName: supportSessions.userName,
        status: supportSessions.status,
      })
      .from(supportSessions)
      .where(eq(supportSessions.id, sessionId))
      .limit(1);
    if (sessionRows.length === 0) {
      throw new NotFoundException('会话不存在');
    }
    const session = sessionRows[0];
    if (session.userId !== userId) {
      throw new ForbiddenException('无权访问该会话');
    }
    if (session.status === 'closed') {
      throw new BadRequestException('会话已关闭，无法发送消息');
    }

    const now = new Date();
    const displayContent = msgType === 'text' ? content : '[图片]';

    // 插入消息与更新会话最后一条并发执行，省掉一次串行往返
    const [inserted] = await Promise.all([
      this.db
        .insert(supportMessages)
        .values({
          sessionId,
          senderRole: 'user',
          senderId: userId,
          senderName: session.userName,
          msgType,
          content: content ?? '',
          imageUrl: imageUrl ?? '',
          isSystem: false,
        })
        .returning(),
      this.db
        .update(supportSessions)
        .set({
          lastMessage: displayContent,
          lastMessageAt: now,
          unreadAdminCount: sql`${supportSessions.unreadAdminCount} + 1`,
        })
        .where(eq(supportSessions.id, sessionId)),
    ]);

    return this.toMessageDto(inserted[0]);
  }

  async getAdminList(
    page: number,
    pageSize: number,
    sessionType?: string,
  ): Promise<{ items: SupportSession[]; total: number }> {
    const whereConditions = [];
    if (sessionType && sessionType !== 'all') {
      whereConditions.push(eq(supportSessions.sessionType, sessionType));
    }

    const whereClause = whereConditions.length > 0
      ? and(...whereConditions)
      : undefined;

    const [listResult, countResult] = await Promise.all([
      this.db
        .select()
        .from(supportSessions)
        .where(whereClause)
        .orderBy(desc(supportSessions.lastMessageAt), desc(supportSessions.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      this.db
        .select({ count: count() })
        .from(supportSessions)
        .where(whereClause),
    ]);

    const items: SupportSession[] = listResult.map((row) => this.toSessionDto(row));
    const total = Number(countResult[0]?.count ?? 0);

    return { items, total };
  }

  async getMessagesByAdmin(sessionId: string): Promise<SupportMessage[]> {
    // 一次查询完成「会话存在校验 + 清零后台未读」
    const sessionRows = await this.db
      .update(supportSessions)
      .set({ unreadAdminCount: 0 })
      .where(eq(supportSessions.id, sessionId))
      .returning({ id: supportSessions.id });
    if (sessionRows.length === 0) {
      throw new NotFoundException('会话不存在');
    }

    const rows = await this.db
      .select()
      .from(supportMessages)
      .where(eq(supportMessages.sessionId, sessionId))
      .orderBy(supportMessages.createdAt);

    return rows.map((row) => this.toMessageDto(row));
  }

  async sendAdminMessage(
    sessionId: string,
    adminId: string,
    adminName: string,
    msgType: 'text' | 'image',
    content: string,
    imageUrl: string,
  ): Promise<SupportMessage> {
    if (msgType === 'text' && !content?.trim()) {
      throw new BadRequestException('消息内容不能为空');
    }
    if (msgType === 'image' && !imageUrl) {
      throw new BadRequestException('图片不能为空');
    }

    const sessionRows = await this.db
      .select({
        id: supportSessions.id,
        userId: supportSessions.userId,
        status: supportSessions.status,
      })
      .from(supportSessions)
      .where(eq(supportSessions.id, sessionId))
      .limit(1);
    if (sessionRows.length === 0) {
      throw new NotFoundException('会话不存在');
    }
    const session = sessionRows[0];
    if (session.status === 'closed') {
      throw new BadRequestException('会话已关闭，无法发送消息');
    }

    const now = new Date();
    const displayContent = msgType === 'text' ? content : '[图片]';
    const senderDisplay = adminName || '平台客服';

    const [inserted] = await Promise.all([
      this.db
        .insert(supportMessages)
        .values({
          sessionId,
          senderRole: 'platform',
          senderId: adminId,
          senderName: senderDisplay,
          msgType,
          content: content ?? '',
          imageUrl: imageUrl ?? '',
          isSystem: false,
        })
        .returning(),
      this.db
        .update(supportSessions)
        .set({
          lastMessage: displayContent,
          lastMessageAt: now,
          unreadUserCount: sql`${supportSessions.unreadUserCount} + 1`,
        })
        .where(eq(supportSessions.id, sessionId)),
    ]);

    const message = this.toMessageDto(inserted[0]);

    // 给用户发站内通知
    void this.notificationsService.send(
      'user',
      session.userId,
      '客服回复',
      '客服回复了你的消息',
      'support',
      sessionId,
    );

    return message;
  }

  async closeSession(
    sessionId: string,
    closingRemark?: string,
  ): Promise<SupportSession> {
    const sessionRows = await this.db
      .select()
      .from(supportSessions)
      .where(eq(supportSessions.id, sessionId))
      .limit(1);
    if (sessionRows.length === 0) {
      throw new NotFoundException('会话不存在');
    }
    const session = sessionRows[0];
    if (session.status === 'closed') {
      return this.toSessionDto(session);
    }

    const result = await this.db.transaction(async (tx) => {
      const updated = await tx
        .update(supportSessions)
        .set({ status: 'closed' })
        .where(eq(supportSessions.id, sessionId))
        .returning();

      if (closingRemark?.trim()) {
        await tx.insert(supportMessages).values({
          sessionId,
          senderRole: 'system',
          senderId: null,
          senderName: '系统',
          msgType: 'text',
          content: `会话已结束。备注：${closingRemark.trim()}`,
          imageUrl: '',
          isSystem: true,
        });

        await tx
          .update(supportSessions)
          .set({ lastMessage: `会话已结束。备注：${closingRemark.trim()}` })
          .where(eq(supportSessions.id, sessionId));
      } else {
        await tx.insert(supportMessages).values({
          sessionId,
          senderRole: 'system',
          senderId: null,
          senderName: '系统',
          msgType: 'text',
          content: '会话已结束',
          imageUrl: '',
          isSystem: true,
        });

        await tx
          .update(supportSessions)
          .set({ lastMessage: '会话已结束' })
          .where(eq(supportSessions.id, sessionId));
      }

      return updated[0];
    });

    return this.toSessionDto(result);
  }

  async markAdminRead(sessionId: string): Promise<{ success: boolean }> {
    const sessionRows = await this.db
      .select({ id: supportSessions.id })
      .from(supportSessions)
      .where(eq(supportSessions.id, sessionId))
      .limit(1);
    if (sessionRows.length === 0) {
      throw new NotFoundException('会话不存在');
    }

    await this.db
      .update(supportSessions)
      .set({ unreadAdminCount: 0 })
      .where(and(
        eq(supportSessions.id, sessionId),
        sql`${supportSessions.unreadAdminCount} > 0`,
      ));

    return { success: true };
  }
}
