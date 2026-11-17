import { IsOptional, IsString, IsIn } from 'class-validator';
import { MESSAGE_TYPES } from '@shared/api.interface';

export class SendSupportMessageDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsIn(MESSAGE_TYPES)
  msgType!: 'text' | 'image';

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;
}
