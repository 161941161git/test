import { IsString, IsNotEmpty, IsOptional, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import type { ConfirmRefundRequest } from '@shared/api.interface';

export class ConfirmRefundDto implements ConfirmRefundRequest {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  refundAmountFen?: number;

  @IsString()
  @IsNotEmpty({ message: '退款说明不能为空' })
  remark!: string;
}
