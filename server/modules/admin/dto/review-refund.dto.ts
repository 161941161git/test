import { IsString, IsNotEmpty } from 'class-validator';

export class ApproveRefundDto {
}

export class RejectRefundDto {
  @IsString()
  @IsNotEmpty({ message: '拒绝理由不能为空' })
  rejectReason!: string;
}

export class PlatformWithdrawDto {
  @IsString()
  @IsNotEmpty({ message: '提现金额不能为空' })
  amount!: string;
}
