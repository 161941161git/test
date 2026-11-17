import { IsString, IsOptional, IsIn } from 'class-validator';

export class SavePaymentConfigDto {
  @IsString()
  @IsIn(['mock', 'real'])
  paymentMode!: 'mock' | 'real';

  @IsOptional() @IsString()
  wechatAppId?: string;

  @IsOptional() @IsString()
  wechatMchId?: string;

  @IsOptional() @IsString()
  wechatApiV3Key?: string;

  @IsOptional() @IsString()
  wechatCertSerial?: string;

  @IsOptional() @IsString()
  wechatPrivateKey?: string;

  @IsOptional() @IsString()
  wechatPlatformCert?: string;

  @IsOptional() @IsString()
  alipayAppId?: string;

  @IsOptional() @IsString()
  alipayPrivateKey?: string;

  @IsOptional() @IsString()
  alipayPublicKey?: string;
}
