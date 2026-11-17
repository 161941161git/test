import { Controller, Post, Get, Body, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderListQueryDto } from './dto/order-list.dto';
import { AcceptOrderDto } from './dto/accept-order.dto';
import { ConfirmOrderDto } from './dto/confirm-order.dto';
import { RefundApplyDto } from './dto/refund.dto';
import type { ApiResp, FeeDetail, Order, OrderListResponse } from '@shared/api.interface';

@Controller('api/orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  /** 计费预览 */
  @Post('calculate-fee')
  @HttpCode(HttpStatus.OK)
  async calculateFee(
    @Body() body: { packageCount: number; isRainy: boolean; isUrgent: boolean },
  ): Promise<ApiResp<FeeDetail>> {
    const data = this.ordersService.calculateFee(body.packageCount, body.isRainy, body.isUrgent);
    return { success: true, data, message: '计费成功' };
  }

  /** 创建订单 */
  @Post()
  async createOrder(@Body() dto: CreateOrderDto): Promise<ApiResp<Order>> {
    const data = await this.ordersService.createOrder(dto);
    return { success: true, data, message: '下单成功' };
  }

  /** 订单列表 */
  @Get()
  async getOrderList(@Query() query: OrderListQueryDto): Promise<ApiResp<OrderListResponse>> {
    const data = await this.ordersService.getOrderList({
      status: query.status,
      paymentStatus: query.paymentStatus,
      buyerId: query.buyerId,
      runnerId: query.runnerId,
      excludeBuyerId: query.excludeBuyerId,
      page: query.page,
      pageSize: query.pageSize,
    });
    return { success: true, data, message: '获取成功' };
  }

  /** 订单详情 */
  @Get(':id')
  async getOrderDetail(@Param('id') id: string): Promise<ApiResp<Order>> {
    const data = await this.ordersService.getOrderDetail(id);
    return { success: true, data, message: '获取成功' };
  }

  /** 接单 */
  @Post(':id/accept')
  async acceptOrder(
    @Param('id') id: string,
    @Body() dto: AcceptOrderDto,
  ): Promise<ApiResp<Order>> {
    const data = await this.ordersService.acceptOrder(id, dto.runnerId);
    return { success: true, data, message: '接单成功' };
  }

  /** 标记送达 */
  @Post(':id/deliver')
  async deliverOrder(
    @Param('id') id: string,
    @Body() dto: AcceptOrderDto,
  ): Promise<ApiResp<{ order: Order; settlementSessionId: string }>> {
    const data = await this.ordersService.deliverOrder(id, dto.runnerId);
    return { success: true, data, message: '已标记送达' };
  }

  /** 确认收货 */
  @Post(':id/confirm')
  async confirmOrder(
    @Param('id') id: string,
    @Body() dto: ConfirmOrderDto,
  ): Promise<ApiResp<Order>> {
    const data = await this.ordersService.confirmOrder(id, dto.buyerId);
    return { success: true, data, message: '确认收货成功' };
  }

  /** 申请退款 */
  @Post(':id/refund')
  async applyRefund(
    @Param('id') id: string,
    @Body() dto: RefundApplyDto,
  ): Promise<ApiResp<{ order: Order; refund: { id: string; status: string; reason: string; createdAt: string }; sessionId: string }>> {
    const result = await this.ordersService.applyRefund(id, dto.buyerId, dto.reason, dto.screenshotUrl);
    return {
      success: true,
      data: {
        order: result.order,
        refund: {
          id: result.refund.id,
          status: result.refund.status,
          reason: result.refund.reason,
          createdAt: result.refund.createdAt.toISOString(),
        },
        sessionId: result.sessionId,
      },
      message: '退款申请已提交',
    };
  }

  /** 标记买家已付款（待核对） */
  @Post(':id/mark-paid')
  async markBuyerPaid(
    @Param('id') id: string,
    @Body() dto: { payProofUrl?: string; payRemark?: string },
  ): Promise<ApiResp<null>> {
    await this.ordersService.markBuyerPaid(id, dto.payProofUrl ?? '', dto.payRemark ?? '');
    return { success: true, data: null, message: '已标记付款，等待平台核对' };
  }

  /** 管理员强制完成 */
  @Post(':id/force-complete')
  async forceComplete(@Param('id') id: string): Promise<ApiResp<Order>> {
    const data = await this.ordersService.forceComplete(id);
    return { success: true, data, message: '订单已强制完成' };
  }

  /** 管理员取消订单 */
  @Post(':id/cancel')
  async cancelOrder(@Param('id') id: string): Promise<ApiResp<Order>> {
    const data = await this.ordersService.cancelOrder(id);
    return { success: true, data, message: '订单已取消' };
  }
}
