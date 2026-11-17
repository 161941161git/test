import { IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class SupportListDto {
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
  sessionType?: string;
}
