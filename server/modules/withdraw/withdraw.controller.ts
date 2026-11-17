import { Controller } from '@nestjs/common';
import { WithdrawService } from './withdraw.service';

/**
 * 提现相关路由已全部隐藏（仅保留 Service 供内部调用）
 * 如需恢复，取消下方注释即可。
 */
@Controller('api/withdraw')
export class WithdrawController {
  constructor(private readonly withdrawService: WithdrawService) {}

  // @Post('apply')
  // async apply(@Body() dto: ApplyWithdrawDto): Promise<ApiResp<WithdrawRequest>> {
  //   const data = await this.withdrawService.applyWithdraw(
  //     dto.userId,
  //     dto.amount,
  //     dto.channel,
  //   );
  //   return { success: true, data, message: '提现申请提交成功' };
  // }

  // @Get('my/:userId')
  // async getMyWithdraws(
  //   @Param('userId') userId: string,
  // ): Promise<ApiResp<WithdrawListResponse>> {
  //   const data = await this.withdrawService.getMyWithdraws(userId);
  //   return { success: true, data, message: '获取成功' };
  // }

  // @UseGuards(AdminAuthGuard)
  // @Get()
  // async getWithdrawList(
  //   @Query('status') status?: string,
  // ): Promise<ApiResp<WithdrawListResponse>> {
  //   const data = await this.withdrawService.getWithdrawList(status);
  //   return { success: true, data, message: '获取成功' };
  // }

  // @UseGuards(AdminAuthGuard)
  // @Post(':id/paid')
  // async markPaid(
  //   @Req() req: { admin: { name: string } },
  //   @Param('id') id: string,
  // ): Promise<ApiResp<WithdrawRequest>> {
  //   const data = await this.withdrawService.markPaid(id, req.admin.name);
  //   return { success: true, data, message: '已标记打款' };
  // }

  // @UseGuards(AdminAuthGuard)
  // @Post(':id/reject')
  // async reject(
  //   @Req() req: { admin: { name: string } },
  //   @Param('id') id: string,
  //   @Body() dto: RejectWithdrawDto,
  // ): Promise<ApiResp<WithdrawRequest>> {
  //   const data = await this.withdrawService.rejectWithdraw(
  //     id,
  //     req.admin.name,
  //     dto.failReason,
  //   );
  //   return { success: true, data, message: '提现已拒绝' };
  // }
}
