import { IsOptional, IsString, IsInt, Min, Max, IsIn } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ORDER_STATUSES, PAYMENT_STATUSES, type OrderStatus, type PaymentStatus } from '@shared/api.interface';

export class OrderListQueryDto {
  @IsOptional()
  @Type(() => String)
  @IsString()
  @IsIn(ORDER_STATUSES, { message: '订单状态无效' })
  status?: OrderStatus;

  @IsOptional()
  @Type(() => String)
  @IsString()
  @IsIn(PAYMENT_STATUSES, { message: '支付状态无效' })
  paymentStatus?: PaymentStatus;

  @IsOptional()
  @IsString()
  buyerId?: string;

  @IsOptional()
  @IsString()
  runnerId?: string;

  @IsOptional()
  @IsString()
  excludeBuyerId?: string;

  @IsOptional()
  @Transform(({ obj, key, value }) => (obj[key] === '' ? undefined : value))
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Transform(({ obj, key, value }) => (obj[key] === '' ? undefined : value))
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
