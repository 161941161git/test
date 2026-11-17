import { IsString, IsNotEmpty } from 'class-validator';

export class RejectWithdrawDto {
  @IsString()
  @IsNotEmpty({ message: '拒绝理由不能为空' })
  failReason!: string;
}
