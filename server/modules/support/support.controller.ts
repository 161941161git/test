import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';

import { SupportService } from './support.service';
import { SendSupportMessageDto } from './dto/send-message.dto';
import { SupportListDto } from './dto/support-list.dto';
import { CloseSessionDto } from './dto/close-session.dto';
import { AdminAuthGuard } from '../admin/admin-auth.guard';
import type {
  ApiResp,
  SupportSession,
  SupportMessage,
  SupportSessionType,
} from '@shared/api.interface';

@Controller('api/support')
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  // ========== 用户端接口 ==========

  @Get('user-session')
  async getOrCreateUserSession(
    @Query('sessionType') sessionType: string,
    @Query('userId') userId: string,
  ): Promise<ApiResp<SupportSession>> {
    const data = await this.supportService.getOrCreateUserSession(
      userId,
      sessionType as SupportSessionType,
    );
    return { success: true, data, message: 'ok' };
  }

  @Get(':id/messages')
  async getUserMessages(
    @Param('id') id: string,
    @Query('userId') userId: string,
  ): Promise<ApiResp<SupportMessage[]>> {
    const items = await this.supportService.getMessagesByUser(id, userId);
    return { success: true, data: items, message: 'ok' };
  }

  @Post(':id/send')
  async sendUserMessage(
    @Param('id') id: string,
    @Body() dto: SendSupportMessageDto,
  ): Promise<ApiResp<SupportMessage>> {
    const data = await this.supportService.sendUserMessage(
      id,
      dto.userId ?? '',
      dto.msgType,
      dto.content ?? '',
      dto.imageUrl ?? '',
    );
    return { success: true, data, message: 'ok' };
  }

  // ========== 后台接口 ==========

  @UseGuards(AdminAuthGuard)
  @Get('admin/list')
  async getAdminList(
    @Query() query: SupportListDto,
  ): Promise<ApiResp<{ items: SupportSession[]; total: number }>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const data = await this.supportService.getAdminList(
      page,
      pageSize,
      query.sessionType,
    );
    return { success: true, data, message: 'ok' };
  }

  @UseGuards(AdminAuthGuard)
  @Get('admin/:id/messages')
  async getAdminMessages(
    @Param('id') id: string,
  ): Promise<ApiResp<SupportMessage[]>> {
    const items = await this.supportService.getMessagesByAdmin(id);
    return { success: true, data: items, message: 'ok' };
  }

  @UseGuards(AdminAuthGuard)
  @Post('admin/:id/send')
  async sendAdminMessage(
    @Param('id') id: string,
    @Body() dto: SendSupportMessageDto,
    @Req() req: { admin?: { adminId: string; name: string } },
  ): Promise<ApiResp<SupportMessage>> {
    const adminId = req.admin?.adminId ?? '';
    const adminName = req.admin?.name ?? '平台客服';
    const data = await this.supportService.sendAdminMessage(
      id,
      adminId,
      adminName,
      dto.msgType,
      dto.content ?? '',
      dto.imageUrl ?? '',
    );
    return { success: true, data, message: 'ok' };
  }

  @UseGuards(AdminAuthGuard)
  @Post('admin/:id/close')
  async closeSession(
    @Param('id') id: string,
    @Body() dto: CloseSessionDto,
  ): Promise<ApiResp<SupportSession>> {
    const data = await this.supportService.closeSession(id, dto.closingRemark);
    return { success: true, data, message: '会话已结束' };
  }

  @UseGuards(AdminAuthGuard)
  @Post('admin/:id/mark-read')
  async markAdminRead(@Param('id') id: string): Promise<ApiResp<{ success: boolean }>> {
    const data = await this.supportService.markAdminRead(id);
    return { success: true, data, message: 'ok' };
  }
}
