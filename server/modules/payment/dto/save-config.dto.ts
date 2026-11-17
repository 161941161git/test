import { IsString, IsIn, IsOptional, IsBoolean } from 'class-validator';
import type { SavePaymentConfigRequest } from '@shared/api.interface';

const PAYMENT_MODES = ['mock', 'real'] as const;

export class SavePaymentConfigDto implements SavePaymentConfigRequest {
  @IsString()
  @IsIn(PAYMENT_MODES, { message: '支付模式无效' })
  paymentMode!: 'mock' | 'real';

  @IsOptional()
  @IsString()
  wechatAppId!: string;

  @IsOptional()
  @IsString()
  wechatMchId!: string;

  @IsOptional()
  @IsString()
  wechatApiV3Key!: string;

  @IsOptional()
  @IsString()
  wechatCertSerial!: string;

  @IsOptional()
  @IsString()
  wechatPrivateKey!: string;

  @IsOptional()
  @IsString()
  wechatPlatformCert!: string;

  @IsOptional()
  @IsString()
  alipayAppId!: string;

  @IsOptional()
  @IsString()
  alipayPrivateKey!: string;

  @IsOptional()
  @IsString()
  alipayPublicKey!: string;

  @IsBoolean()
  isManualMode!: boolean;
}
