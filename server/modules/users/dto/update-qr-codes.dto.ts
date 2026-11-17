import { IsString } from 'class-validator';

export class UpdateQrCodesDto {
  @IsString()
  wechatQrUrl!: string;

  @IsString()
  alipayQrUrl!: string;
}
