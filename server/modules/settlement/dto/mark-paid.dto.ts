import { IsOptional, IsString, MaxLength } from 'class-validator';

export class MarkSettlementPaidDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  remark?: string;
}
