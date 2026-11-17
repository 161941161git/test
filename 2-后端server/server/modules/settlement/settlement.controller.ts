import { Controller, Get, Post, Body, Param, Query, UseGuards, Req } from '@nestjs/common';

import { SettlementService } from './settlement.service';
import { SendSettlementMessageDto } from './dto/send-message.dto';
import { MarkSettlementPaidDto } from './dto/mark-paid.dto';
import { SettlementListDto } from './dto/settlement-list.dto';
import { AdminAuthGuard } from '../admin/admin-auth.guard';
import type {
  ApiResp,
  SettlementSession,
  SettlementMessage,
  RunnerEarningsSummary,
} from '@shared/api.interface';

@Controller('api/settlement')
export class SettlementController {
  constructor(private readonly settlementService: SettlementService) {}

  @Get('runner/list')
  async getRunnerSessions(@Query('userId') userId: string): Promise<ApiResp<SettlementSession[]>> {
    const items = await this.settlementService.getRunnerSessions(userId);
    return { success: true, data: items, message: 'ok' };
  }

  @Get('runner/earnings')
  async getRunnerEarnings(@Query('userId') userId: string): Promise<ApiResp<RunnerEarningsSummary>> {
    const data = await this.settlementService.getRunnerEarningsSummary(userId);
    return { success: true, data, message: 'ok' };
  }

  @UseGuards(AdminAuthGuard)
  @Get('admin/list')
  async listSessions(@Query() query: SettlementListDto): Promise<ApiResp<{ items: SettlementSession[]; total: number }>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const result = await this.settlementService.listSessions(
      page,
      pageSize,
      query.status,
      query.runnerName,
    );
    return { success: true, data: result, message: 'ok' };
  }

  @UseGuards(AdminAuthGuard)
  @Get('admin/:id')
  async adminGetSession(
    @Param('id') id: string,
  ): Promise<ApiResp<SettlementSession>> {
    const data = await this.settlementService.getSession(id);
    return { success: true, data, message: 'ok' };
  }

  @UseGuards(AdminAuthGuard)
  @Get('admin/:id/messages')
  async adminGetMessages(
    @Param('id') id: string,
  ): Promise<ApiResp<SettlementMessage[]>> {
    const data = await this.settlementService.getMessages(id);
    return { success: true, data, message: 'ok' };
  }

  @UseGuards(AdminAuthGuard)
  @Post('admin/:id/send')
  async adminSendMessage(
    @Param('id') id: string,
    @Body() dto: SendSettlementMessageDto,
  ): Promise<ApiResp<SettlementMessage>> {
    const data = await this.settlementService.sendMessage(
      id,
      'platform',
      dto.msgType,
      dto.content ?? '',
      dto.imageUrl ?? '',
    );
    return { success: true, data, message: 'ok' };
  }

  @Get(':id')
  async getSession(
    @Param('id') id: string,
    @Query('userId') userId: string,
  ): Promise<ApiResp<SettlementSession>> {
    const data = await this.settlementService.getSessionAsRunner(id, userId);
    return { success: true, data, message: 'ok' };
  }

  @Get(':id/messages')
  async getMessages(
    @Param('id') id: string,
    @Query('userId') userId: string,
  ): Promise<ApiResp<SettlementMessage[]>> {
    const data = await this.settlementService.getMessagesAsRunner(id, userId);
    return { success: true, data, message: 'ok' };
  }

  @UseGuards(AdminAuthGuard)
  @Post(':id/mark-paid')
  async markPaid(
    @Param('id') id: string,
    @Body() dto: MarkSettlementPaidDto,
  ): Promise<ApiResp<null>> {
    await this.settlementService.markPaid(id, dto.remark ?? '', '管理员');
    return { success: true, data: null, message: '已标记打款' };
  }

  @Post(':id/send')
  async sendMessage(
    @Param('id') id: string,
    @Body() dto: SendSettlementMessageDto,
  ): Promise<ApiResp<SettlementMessage>> {
    const data = await this.settlementService.sendMessageAsRunner(
      id,
      dto.userId ?? '',
      dto.msgType,
      dto.content ?? '',
      dto.imageUrl ?? '',
    );
    return { success: true, data, message: 'ok' };
  }
}
