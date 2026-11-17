import { IsString, IsIn, IsOptional, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';
import { PAY_CHANNELS, type PayChannel } from '@shared/api.interface';

export class SaveAccountDto {
  @IsString()
  @Type(() => String)
  @IsIn(PAY_CHANNELS, { message: '支付渠道无效' })
  channel!: PayChannel;

  @IsString()
  @IsNotEmpty({ message: '账户号不能为空' })
  accountNo!: string;

  @IsOptional()
  @IsString()
  realName?: string;
}
