import { IsString, Length, Matches } from 'class-validator';

export class ApplyRunnerDto {
  @IsString()
  userId!: string;

  @IsString()
  @Length(1, 50)
  name!: string;

  @IsString()
  @Matches(/^1[3-9]\d{9}$/, { message: '手机号格式不正确' })
  phone!: string;

  @IsString()
  @Length(1, 100)
  wechatId!: string;

  @IsString()
  paymentQrUrl!: string;
}
