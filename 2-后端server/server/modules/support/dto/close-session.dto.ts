import { IsOptional, IsString } from 'class-validator';

export class CloseSessionDto {
  @IsOptional()
  @IsString()
  closingRemark?: string;
}
