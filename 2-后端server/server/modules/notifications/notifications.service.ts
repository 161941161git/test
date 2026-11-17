import { Inject, Injectable, Logger } from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@server/database/database.module';
import { eq, and, desc, count } from 'drizzle-orm';
import { notifications } from '@server/database/schema';
import type { Notification } from '@shared/api.interface';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  private toDto(row: typeof notifications.$inferSelect): Notification {
    return {
      id: row.id,
      recipientType: row.recipientType as 'user' | 'admin',
      recipientId: row.recipientId,
      title: row.title,
      content: row.content,
      relatedType: row.relatedType ?? null,
      relatedId: row.relatedId ?? null,
      isRead: row.isRead,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async send(
    recipientType: 'user' | 'admin',
    recipientId: string,
    title: string,
    content: string,
    relatedType?: string,
    relatedId?: string,
  ): Promise<void> {
    try {
      await this.db.insert(notifications).values({
        recipientType,
        recipientId,
        title,
        content,
        relatedType: relatedType ?? null,
        relatedId: relatedId ?? null,
        isRead: false,
      });
    } catch (error) {
      this.logger.error('发送通知失败', error);
    }
  }

  async listByRecipient(
    recipientType: 'user' | 'admin',
    recipientId: string,
    page = 1,
    pageSize = 20,
  ): Promise<{ items: Notification[]; total: number; unreadCount: number }> {
    const offset = (page - 1) * pageSize;

    const whereClause = and(
      eq(notifications.recipientType, recipientType),
      eq(notifications.recipientId, recipientId),
    );

    const [listResult, countResult, unreadResult] = await Promise.all([
      this.db
        .select()
        .from(notifications)
        .where(whereClause)
        .orderBy(desc(notifications.createdAt))
        .limit(pageSize)
        .offset(offset),
      this.db
        .select({ count: count() })
        .from(notifications)
        .where(whereClause),
      this.db
        .select({ count: count() })
        .from(notifications)
        .where(and(whereClause, eq(notifications.isRead, false))),
    ]);

    const items: Notification[] = listResult.map((row) => this.toDto(row));
    const total = Number(countResult[0]?.count ?? 0);
    const unreadCount = Number(unreadResult[0]?.count ?? 0);

    return { items, total, unreadCount };
  }

  async getUnreadCount(
    recipientType: 'user' | 'admin',
    recipientId: string,
  ): Promise<number> {
    const [result] = await this.db
      .select({ count: count() })
      .from(notifications)
      .where(and(
        eq(notifications.recipientType, recipientType),
        eq(notifications.recipientId, recipientId),
        eq(notifications.isRead, false),
      ));

    return Number(result?.count ?? 0);
  }

  async markAllRead(
    recipientType: 'user' | 'admin',
    recipientId: string,
  ): Promise<void> {
    await this.db
      .update(notifications)
      .set({ isRead: true })
      .where(and(
        eq(notifications.recipientType, recipientType),
        eq(notifications.recipientId, recipientId),
        eq(notifications.isRead, false),
      ));
  }

  async markOneRead(
    id: string,
    recipientType: 'user' | 'admin',
    recipientId: string,
  ): Promise<void> {
    await this.db
      .update(notifications)
      .set({ isRead: true })
      .where(and(
        eq(notifications.id, id),
        eq(notifications.recipientType, recipientType),
        eq(notifications.recipientId, recipientId),
      ));
  }
}
