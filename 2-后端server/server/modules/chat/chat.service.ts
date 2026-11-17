import { Injectable, Inject, Logger, BadRequestException } from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@server/database/database.module';
import { eq, asc } from 'drizzle-orm';
import { chatMessages, users } from '@server/database/schema';
import type { ChatMessage, MessageType, UserRole } from '@shared/api.interface';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(@Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase) {}

  async getMessages(orderId: string): Promise<ChatMessage[]> {
    try {
      const results = await this.db
        .select({
          id: chatMessages.id,
          orderId: chatMessages.orderId,
          senderId: chatMessages.senderId,
          senderRole: chatMessages.senderRole,
          senderName: users.name,
          msgType: chatMessages.msgType,
          content: chatMessages.content,
          imageUrl: chatMessages.imageUrl,
          isDeliveryPhoto: chatMessages.isDeliveryPhoto,
          createdAt: chatMessages.createdAt,
        })
        .from(chatMessages)
        .leftJoin(users, eq(chatMessages.senderId, users.id))
        .where(eq(chatMessages.orderId, orderId))
        .orderBy(asc(chatMessages.createdAt));

      return results.map((row) => ({
        id: row.id,
        orderId: row.orderId,
        senderId: row.senderId,
        senderRole: row.senderRole as UserRole,
        senderName: row.senderName ?? '',
        msgType: row.msgType as MessageType,
        content: row.content,
        imageUrl: row.imageUrl,
        isDeliveryPhoto: row.isDeliveryPhoto,
        createdAt: row.createdAt.toISOString(),
      }));
    } catch (error) {
      this.logger.error('获取聊天消息失败', error);
      throw error;
    }
  }

  async sendMessage(params: {
    orderId: string;
    senderId: string;
    senderRole: UserRole;
    msgType: MessageType;
    content: string;
    imageUrl?: string;
    isDeliveryPhoto?: boolean;
  }): Promise<ChatMessage> {
    try {
      if (params.msgType === 'image' && !params.imageUrl) {
        throw new BadRequestException('图片消息必须提供 imageUrl');
      }

      const inserted = await this.db
        .insert(chatMessages)
        .values({
          orderId: params.orderId,
          senderId: params.senderId,
          senderRole: params.senderRole,
          msgType: params.msgType,
          content: params.content,
          imageUrl: params.imageUrl ?? '',
          isDeliveryPhoto: params.isDeliveryPhoto ?? false,
        })
        .returning();

      if (inserted.length === 0) {
        throw new BadRequestException('消息发送失败');
      }

      const msg = inserted[0];

      // 关联查 senderName
      const userRows = await this.db
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, msg.senderId))
        .limit(1);

      return {
        id: msg.id,
        orderId: msg.orderId,
        senderId: msg.senderId,
        senderRole: msg.senderRole as UserRole,
        senderName: userRows[0]?.name ?? '',
        msgType: msg.msgType as MessageType,
        content: msg.content,
        imageUrl: msg.imageUrl,
        isDeliveryPhoto: msg.isDeliveryPhoto,
        createdAt: msg.createdAt.toISOString(),
      };
    } catch (error) {
      this.logger.error('发送消息失败', error);
      throw error;
    }
  }
}
