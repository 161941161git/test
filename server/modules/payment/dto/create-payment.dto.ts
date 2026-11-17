import { IsString, IsUUID, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { PAY_CHANNELS, type CreatePaymentRequest, type PayChannel } from '@shared/api.interface';

export class CreatePaymentDto implements CreatePaymentRequest {
  @IsUUID()
  @IsString()
  orderId!: string;

  @IsString()
  @Type(() => String)
  @IsIn(PAY_CHANNELS, { message: '支付渠道无效' })
  channel!: PayChannel;

  @IsString()
  buyerId!: string;
}
