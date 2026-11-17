import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  ParseUUIDPipe,
} from '@nestjs/common';
import type { Request } from 'express';

import { RefundSessionsService } from './refund-sessions.service';
import { SendRefundMessageDto, AdminRefundListDto } from './dto/send-message.dto';
import { ConfirmRefundDto } from './dto/confirm-refund.dto';
import { RejectRefundDto } from './dto/reject-refund.dto';
import { AdminAuthGuard } from '../admin/admin-auth.guard';
import type {
  ApiResp,
  RefundSession,
  RefundMessage,
} from '@shared/api.interface';

function ok<T>(data: T, message = '操作成功'): ApiResp<T> {
  return { success: true, data, message };
}

@Controller('api/refund-sessions')
export class RefundSessionsController {
  constructor(private readonly refundSessionsService: RefundSessionsService) {}

  // ========== 买家侧 ==========

  @Get('by-order/:orderId')
  async getSessionByOrder(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Query('userId') userId: string,
  ): Promise<ApiResp<RefundSession | null>> {
    const data = await this.refundSessionsService.getSessionByOrderId(orderId, userId);
    return ok(data, '获取成功');
  }

  @Get(':id/messages')
  async getMessages(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('userId') userId: string,
  ): Promise<ApiResp<RefundMessage[]>> {
    const data = await this.refundSessionsService.getMessages(id, userId);
    return ok(data, '获取成功');
  }

  @Post(':id/messages')
  async sendMessage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SendRefundMessageDto,
  ): Promise<ApiResp<RefundMessage>> {
    const data = await this.refundSessionsService.sendBuyerMessage(
      id,
      dto.userId,
      dto.msgType,
      dto.content ?? '',
      dto.imageUrl ?? '',
    );
    return ok(data, '发送成功');
  }
}

@Controller('api/admin/refund-sessions')
@UseGuards(AdminAuthGuard)
export class AdminRefundSessionsController {
  constructor(private readonly refundSessionsService: RefundSessionsService) {}

  @Get()
  async getList(
    @Query() query: AdminRefundListDto,
  ): Promise<ApiResp<{ items: RefundSession[]; total: number }>> {
    const page = query.page ? Number(query.page) : 1;
    const pageSize = query.pageSize ? Number(query.pageSize) : 20;
    const data = await this.refundSessionsService.getAdminList(
      page,
      pageSize,
      query.status,
    );
    return ok(data, '获取成功');
  }

  @Get(':id')
  async getDetail(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResp<{ session: RefundSession; messages: RefundMessage[]; latestImage: string | null }>> {
    const data = await this.refundSessionsService.getAdminDetail(id);
    return ok(data, '获取成功');
  }

  @Get(':id/messages')
  async getMessages(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResp<RefundMessage[]>> {
    const data = await this.refundSessionsService.getMessages(id);
    return ok(data, '获取成功');
  }

  @Post(':id/messages')
  async sendMessage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SendRefundMessageDto,
  ): Promise<ApiResp<RefundMessage>> {
    const data = await this.refundSessionsService.sendPlatformMessage(
      id,
      dto.msgType,
      dto.content ?? '',
      dto.imageUrl ?? '',
    );
    return ok(data, '发送成功');
  }

  @Post(':id/confirm-refund')
  async confirmRefund(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfirmRefundDto,
    @Req() req: { admin: { name: string } },
  ): Promise<ApiResp<RefundSession>> {
    const data = await this.refundSessionsService.confirmRefund(
      id,
      req.admin.name,
      dto.refundAmountFen,
      dto.remark,
    );
    return ok(data, '已确认退款');
  }

  @Post(':id/reject-refund')
  async rejectRefund(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectRefundDto,
    @Req() req: { admin: { name: string } },
  ): Promise<ApiResp<RefundSession>> {
    const data = await this.refundSessionsService.rejectRefund(
      id,
      req.admin.name,
      dto.reason,
    );
    return ok(data, '已拒绝退款');
  }
}
