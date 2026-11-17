import {
  IsString,
  IsUUID,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsIn,
} from 'class-validator';
import { PAY_CHANNELS } from '@shared/api.interface';
import type { WithdrawApplyRequest } from '@shared/api.interface';

export class ApplyWithdrawDto implements WithdrawApplyRequest {
  @IsUUID()
  @IsString()
  userId!: string;

  @IsNumberString()
  @IsNotEmpty()
  amount!: string;

  @IsOptional()
  @IsString()
  @IsIn(PAY_CHANNELS.filter((c) => c !== 'mock'))
  channel?: 'wechat_qr' | 'alipay_qr';
}
