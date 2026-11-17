import { IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class SettlementListDto {
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  pageSize?: number;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  runnerName?: string;
}
