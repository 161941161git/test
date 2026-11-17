import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminAuthGuard } from './admin-auth.guard';
import { AdminLoginDto } from './dto/admin-login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import {
  RejectRefundDto,
  PlatformWithdrawDto,
} from './dto/review-refund.dto';
import { SavePaymentConfigDto } from './dto/save-payment-config.dto';
import { FundTxListDto } from './dto/fund-tx-list.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import type {
  ApiResp,
  AdminLoginResponse,
  AdminDashboard,
  RefundRequest,
  Order,
  ChatMessage,
  OrderListResponse,
  User,
  PaymentConfig,
  FundTxListResponse,
  WithdrawRequest,
  RunnerApplication,
  NotificationListResponse,
} from '@shared/api.interface';

function ok<T>(data: T, message = '操作成功'): ApiResp<T> {
  return { success: true, data, message };
}

@Controller('api/admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ========== 登录 ==========
  @Post('login')
  async login(@Body() dto: AdminLoginDto): Promise<ApiResp<AdminLoginResponse>> {
    const data = await this.adminService.login(dto.username, dto.password);
    return ok(data, '登录成功');
  }

  // ========== 修改密码 ==========
  @UseGuards(AdminAuthGuard)
  @Post('change-password')
  async changePassword(
    @Req() req: { admin: { adminId: string } },
    @Body() dto: ChangePasswordDto,
  ): Promise<ApiResp<{ success: boolean }>> {
    await this.adminService.changePassword(req.admin.adminId, dto.oldPassword, dto.newPassword);
    return ok({ success: true }, '密码修改成功');
  }

  // ========== 看板 ==========
  @UseGuards(AdminAuthGuard)
  @Get('dashboard')
  async getDashboard(): Promise<ApiResp<AdminDashboard>> {
    const data = await this.adminService.getDashboard();
    return ok(data, '获取成功');
  }

  // ========== 退款列表 ==========
  @UseGuards(AdminAuthGuard)
  @Get('refunds')
  async getRefunds(
    @Query('status') status?: string,
  ): Promise<ApiResp<{ items: RefundRequest[]; total: number }>> {
    const data = await this.adminService.getRefundList(status);
    return ok(data, '获取成功');
  }

  // ========== 退款详情 ==========
  @UseGuards(AdminAuthGuard)
  @Get('refunds/:id')
  async getRefundDetail(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResp<{ refund: RefundRequest; order: Order; messages: ChatMessage[] }>> {
    const data = await this.adminService.getRefundDetail(id);
    return ok(data, '获取成功');
  }

  // ========== 审核退款 - 通过 ==========
  @UseGuards(AdminAuthGuard)
  @Post('refunds/:id/approve')
  async approveRefund(
    @Req() req: { admin: { adminId: string; name: string } },
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResp<RefundRequest>> {
    const data = await this.adminService.approveRefund(id, req.admin.name);
    return ok(data, '退款已通过');
  }

  // ========== 审核退款 - 拒绝 ==========
  @UseGuards(AdminAuthGuard)
  @Post('refunds/:id/reject')
  async rejectRefund(
    @Req() req: { admin: { adminId: string; name: string } },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectRefundDto,
  ): Promise<ApiResp<RefundRequest>> {
    const data = await this.adminService.rejectRefund(id, req.admin.name, dto.rejectReason);
    return ok(data, '退款已拒绝');
  }

  // ========== 订单列表 ==========
  @UseGuards(AdminAuthGuard)
  @Get('orders')
  async getOrders(
    @Query('status') status?: string,
  ): Promise<ApiResp<OrderListResponse>> {
    const data = await this.adminService.getOrderList(status);
    return ok(data, '获取成功');
  }

  // ========== 确认到账 / 未收到款 ==========
  @UseGuards(AdminAuthGuard)
  @Post('orders/:id/verify-payment')
  async verifyPayment(
    @Req() req: { admin: { name: string } },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VerifyPaymentDto,
  ): Promise<ApiResp<{ success: boolean }>> {
    await this.adminService.verifyPayment(id, dto.verified, req.admin.name);
    return ok({ success: true }, dto.verified ? '已确认到账' : '已退回待支付');
  }

  // ========== 用户列表 ==========
  @UseGuards(AdminAuthGuard)
  @Get('users')
  async getUsers(
    @Query('isRunner') isRunner?: string,
  ): Promise<ApiResp<{ items: User[]; total: number }>> {
    const isRunnerBool = isRunner === 'true' ? true : isRunner === 'false' ? false : undefined;
    const data = await this.adminService.getUserList(isRunnerBool);
    return ok(data, '获取成功');
  }

  // ========== 平台收益 ==========
  @UseGuards(AdminAuthGuard)
  @Get('earnings')
  async getEarnings(): Promise<ApiResp<{ totalEarnings: string; availableWithdraw: string }>> {
    const data = await this.adminService.getEarnings();
    return ok(data, '获取成功');
  }

  // ========== 平台提现（已隐藏，保留 Service 供内部调用） ==========
  // @UseGuards(AdminAuthGuard)
  // @Post('earnings/withdraw')
  // async platformWithdraw(
  //   @Req() req: { admin: { adminId: string } },
  //   @Body() dto: PlatformWithdrawDto,
  // ): Promise<ApiResp<{ remaining: string }>> {
  //   const data = await this.adminService.platformWithdraw(req.admin.adminId, dto.amount);
  //   return ok(data, '提现成功');
  // }

  // ========== 支付配置 ==========
  @UseGuards(AdminAuthGuard)
  @Get('payment/config')
  async getPaymentConfig(): Promise<ApiResp<PaymentConfig>> {
    const data = await this.adminService.getPaymentConfig();
    return ok(data, '获取成功');
  }

  @UseGuards(AdminAuthGuard)
  @Post('payment/config')
  async savePaymentConfig(
    @Body() dto: SavePaymentConfigDto,
  ): Promise<ApiResp<PaymentConfig>> {
    const data = await this.adminService.savePaymentConfig(dto);
    return ok(data, '保存成功');
  }

  // ========== 资金流水 ==========
  @UseGuards(AdminAuthGuard)
  @Get('fund/transactions')
  async getFundTransactions(
    @Query() query: FundTxListDto,
  ): Promise<ApiResp<FundTxListResponse>> {
    const data = await this.adminService.getFundTransactions(
      query.page ?? 1,
      query.pageSize ?? 20,
      query.txType,
      query.status,
    );
    return ok(data, '获取成功');
  }

  // ========== 重试分账 ==========
  @UseGuards(AdminAuthGuard)
  @Post('profit-sharing/:orderId/retry')
  async retryProfitSharing(
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ): Promise<ApiResp<{ success: boolean }>> {
    const data = await this.adminService.retryProfitSharing(orderId);
    return ok(data, '重试成功');
  }

  // ========== 审核提现 - 通过（已隐藏） ==========
  // @UseGuards(AdminAuthGuard)
  // @Post('withdraws/:id/approve')
  // async approveWithdraw(
  //   @Req() req: { admin: { name: string } },
  //   @Param('id', ParseUUIDPipe) id: string,
  // ): Promise<ApiResp<WithdrawRequest>> {
  //   const data = await this.adminService.approveWithdraw(id, req.admin.name);
  //   return ok(data, '提现已通过');
  // }

  // ========== 审核提现 - 拒绝（已隐藏） ==========
  // @UseGuards(AdminAuthGuard)
  // @Post('withdraws/:id/reject')
  // async rejectWithdraw(
  //   @Req() req: { admin: { name: string } },
  //   @Param('id', ParseUUIDPipe) id: string,
  //   @Body() dto: RejectRefundDto,
  // ): Promise<ApiResp<WithdrawRequest>> {
  //   const data = await this.adminService.rejectWithdraw(id, req.admin.name, dto.rejectReason);
  //   return ok(data, '提现已拒绝');
  // }

  // ========== 兼职申请列表 ==========
  @UseGuards(AdminAuthGuard)
  @Get('runner-applications')
  async getRunnerApplications(
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ): Promise<ApiResp<{ items: RunnerApplication[]; total: number }>> {
    const data = await this.adminService.getRunnerApplications(
      status,
      page ? Number(page) : 1,
      pageSize ? Number(pageSize) : 20,
    );
    return ok(data, '获取成功');
  }

  // ========== 审核兼职申请 - 通过 ==========
  @UseGuards(AdminAuthGuard)
  @Post('runner-applications/:id/approve')
  async approveRunnerApplication(
    @Req() req: { admin: { name: string } },
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResp<RunnerApplication>> {
    const data = await this.adminService.approveRunnerApplication(id, req.admin.name);
    return ok(data, '审核通过');
  }

  // ========== 审核兼职申请 - 拒绝 ==========
  @UseGuards(AdminAuthGuard)
  @Post('runner-applications/:id/reject')
  async rejectRunnerApplication(
    @Req() req: { admin: { name: string } },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectRefundDto,
  ): Promise<ApiResp<RunnerApplication>> {
    const data = await this.adminService.rejectRunnerApplication(
      id,
      req.admin.name,
      dto.rejectReason,
    );
    return ok(data, '审核拒绝');
  }

  // ========== 管理员通知 ==========
  @UseGuards(AdminAuthGuard)
  @Get('notifications')
  async getNotifications(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ): Promise<ApiResp<NotificationListResponse>> {
    const data = await this.adminService.getNotifications(
      page ? Number(page) : 1,
      pageSize ? Number(pageSize) : 20,
    );
    return ok(data, '获取成功');
  }

  @UseGuards(AdminAuthGuard)
  @Post('notifications/read-all')
  async markAllNotificationsRead(): Promise<ApiResp<{ success: boolean }>> {
    await this.adminService.markAllNotificationsRead();
    return ok({ success: true }, '已全部标为已读');
  }

  @UseGuards(AdminAuthGuard)
  @Post('notifications/:notifId/read')
  async markNotificationRead(
    @Param('notifId') notifId: string,
  ): Promise<ApiResp<{ success: boolean }>> {
    await this.adminService.markNotificationRead(notifId);
    return ok({ success: true }, '已标为已读');
  }
}
