import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/send-message.dto';
import type { ApiResp, ChatMessage } from '@shared/api.interface';

@Controller('api/chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get(':orderId')
  async getMessages(@Param('orderId') orderId: string): Promise<ApiResp<ChatMessage[]>> {
    const data = await this.chatService.getMessages(orderId);
    return { success: true, data, message: '获取成功' };
  }

  @Post('send')
  async sendMessage(@Body() dto: SendMessageDto): Promise<ApiResp<ChatMessage>> {
    const data = await this.chatService.sendMessage({
      orderId: dto.orderId,
      senderId: dto.senderId,
      senderRole: dto.senderRole,
      msgType: dto.msgType,
      content: dto.content,
      imageUrl: dto.imageUrl,
      isDeliveryPhoto: dto.isDeliveryPhoto,
    });
    return { success: true, data, message: '发送成功' };
  }
}
