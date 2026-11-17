import {
  IsString,
  IsIn,
  IsInt,
  IsOptional,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';
import { FUND_TX_TYPES, FUND_TX_STATUSES } from '@shared/api.interface';

export class CreateFundTxDto {
  @IsOptional()
  @IsString()
  orderId?: string;

  @IsString()
  @IsNotEmpty({ message: '交易类型不能为空' })
  @IsIn(FUND_TX_TYPES, { message: '交易类型不合法' })
  @Type(() => String)
  txType!: (typeof FUND_TX_TYPES)[number];

  @IsInt()
  @Type(() => Number)
  amountFen!: number;

  @IsString()
  @IsIn(['in', 'out'], { message: '方向不合法' })
  direction!: 'in' | 'out';

  @IsString()
  @IsNotEmpty({ message: '渠道不能为空' })
  channel!: string;

  @IsString()
  @IsNotEmpty({ message: '状态不能为空' })
  @IsIn(FUND_TX_STATUSES, { message: '状态不合法' })
  @Type(() => String)
  status!: (typeof FUND_TX_STATUSES)[number];

  @IsOptional()
  @IsString()
  runnerId?: string;

  @IsOptional()
  @IsString()
  adminId?: string;

  @IsOptional()
  @IsString()
  remark?: string;
}
