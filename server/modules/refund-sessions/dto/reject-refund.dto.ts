import { IsString, IsNotEmpty } from 'class-validator';
import type { RejectRefundRequest } from '@shared/api.interface';

export class RejectRefundDto implements RejectRefundRequest {
  @IsString()
  @IsNotEmpty({ message: '拒绝理由不能为空' })
  reason!: string;
}
