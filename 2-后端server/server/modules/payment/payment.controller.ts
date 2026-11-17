import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PaymentService } from './payment.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { SavePaymentConfigDto } from './dto/save-config.dto';
import { SaveAccountDto } from './dto/save-account.dto';
import { FundTxListDto } from './dto/fund-tx-list.dto';
import { AdminAuthGuard } from '../admin/admin-auth.guard';
import type {
  ApiResp,
  PaymentOrder,
  CreatePaymentResponse,
  PaymentConfig,
  PaymentAccount,
  FundTransaction,
  FundTxListResponse,
  FundDashboard,
  ProfitSharingRecord,
} from '@shared/api.interface';

@Controller('api/payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  // ========== 支付单 ==========

  /** 获取支付模式（公开） */
  @Get('mode')
  async getMode(): Promise<ApiResp<{ mode: 'mock' | 'real' }>> {
    const config = await this.paymentService.getConfig();
    return { success: true, data: { mode: config.paymentMode }, message: '获取成功' };
  }

  /** 创建支付单 */
  @Post('orders')
  async createPayment(
    @Body() dto: CreatePaymentDto,
  ): Promise<ApiResp<CreatePaymentResponse>> {
    const data = await this.paymentService.createPayment(dto.orderId, dto.channel, dto.buyerId);
    return { success: true, data, message: '支付单创建成功' };
  }

  /** 模拟支付成功（公开，mock 模式专用） */
  @Post('mock-success')
  @HttpCode(HttpStatus.OK)
  async mockPaySuccess(@Body() body: { payNo: string }): Promise<ApiResp<PaymentOrder>> {
    const data = await this.paymentService.mockPaySuccess(body.payNo);
    return { success: true, data, message: '支付成功' };
  }

  /** 微信支付回调（预留） */
  @Post('wechat/notify')
  @HttpCode(HttpStatus.OK)
  async wechatNotify(@Body() _body: unknown): Promise<{ code: string; message: string }> {
    // TODO: 微信支付回调验签 + 处理
    return { code: 'SUCCESS', message: 'OK' };
  }

  /** 支付宝回调（预留） */
  @Post('alipay/notify')
  @HttpCode(HttpStatus.OK)
  async alipayNotify(@Body() _body: unknown): Promise<string> {
    // TODO: 支付宝回调验签 + 处理
    return 'success';
  }

  // ========== 收款账户 ==========

  /** 获取当前用户收款账户列表（需登录） */
  @Get('accounts')
  async getAccounts(
    @Req() req: { userContext?: { userId: string; userName: string } },
  ): Promise<ApiResp<PaymentAccount[]>> {
    const userId = req.userContext?.userId;
    if (!userId) {
      return { success: false, data: [], message: '未登录' };
    }
    const data = await this.paymentService.getPaymentAccount(userId);
    return { success: true, data, message: '获取成功' };
  }

  /** 保存收款账户（需登录） */
  @Post('accounts')
  async saveAccount(
    @Req() req: { userContext?: { userId: string; userName: string } },
    @Body() dto: SaveAccountDto,
  ): Promise<ApiResp<PaymentAccount>> {
    const userId = req.userContext?.userId;
    if (!userId) {
      return { success: false, data: {} as PaymentAccount, message: '未登录' };
    }
    const data = await this.paymentService.savePaymentAccount(
      userId,
      dto.channel,
      dto.accountNo,
      dto.realName,
    );
    return { success: true, data, message: '保存成功' };
  }

  // ========== 支付配置（管理员） ==========

  /** 获取支付配置（管理员） */
  @Get('config')
  @UseGuards(AdminAuthGuard)
  async getConfig(): Promise<ApiResp<PaymentConfig>> {
    const data = await this.paymentService.getConfig();
    return { success: true, data, message: '获取成功' };
  }

  /** 保存支付配置（管理员） */
  @Post('config')
  @UseGuards(AdminAuthGuard)
  async saveConfig(@Body() dto: SavePaymentConfigDto): Promise<ApiResp<PaymentConfig>> {
    const data = await this.paymentService.saveConfig(dto);
    return { success: true, data, message: '保存成功' };
  }

  // ========== 资金流水（管理员） ==========

  /** 资金流水列表（管理员） */
  @Get('transactions')
  @UseGuards(AdminAuthGuard)
  async getTransactions(@Query() query: FundTxListDto): Promise<ApiResp<FundTxListResponse>> {
    const data = await this.paymentService.getFundTransactions({
      page: query.page,
      pageSize: query.pageSize,
      txType: query.txType,
      status: query.status,
    });
    return { success: true, data, message: '获取成功' };
  }

  // ========== 资金看板（管理员） ==========

  @Get('dashboard')
  @UseGuards(AdminAuthGuard)
  async getDashboard(): Promise<ApiResp<FundDashboard>> {
    const data = await this.paymentService.getFundDashboard();
    return { success: true, data, message: '获取成功' };
  }

  // ========== 重试分账（管理员） ==========

  @Post('profit-sharing/:orderId/retry')
  @UseGuards(AdminAuthGuard)
  async retryProfitSharing(
    @Param('orderId') orderId: string,
  ): Promise<ApiResp<ProfitSharingRecord>> {
    const data = await this.paymentService.retryProfitSharing(orderId);
    return { success: true, data, message: '分账重试成功' };
  }
}
