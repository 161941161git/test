import { IsOptional, IsString, IsInt, Min, Max, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { FUND_TX_TYPES } from '@shared/api.interface';

export class FundTxListDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;

  @IsOptional()
  @IsString()
  @IsIn(FUND_TX_TYPES, { message: '流水类型无效' })
  txType?: string;

  @IsOptional()
  @IsString()
  @IsIn(['pending', 'success', 'failed'], { message: '状态无效' })
  status?: string;
}
