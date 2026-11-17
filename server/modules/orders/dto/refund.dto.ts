import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import type { ApplyRefundRequest } from '@shared/api.interface';

export class RefundApplyDto implements ApplyRefundRequest {
  @IsString()
  @IsNotEmpty({ message: '买家ID不能为空' })
  buyerId!: string;

  @IsString()
  @IsNotEmpty({ message: '退款理由不能为空' })
  reason!: string;

  @IsOptional()
  @IsString()
  screenshotUrl?: string;
}
