import { IsString, IsIn, IsOptional, IsNotEmpty } from 'class-validator';
import { MESSAGE_TYPES } from '@shared/api.interface';
import type { SendRefundMessageRequest } from '@shared/api.interface';

export class SendRefundMessageDto implements SendRefundMessageRequest {
  @IsString()
  @IsNotEmpty({ message: '用户ID不能为空' })
  userId!: string;

  @IsString()
  @IsIn(MESSAGE_TYPES, { message: '消息类型不正确' })
  msgType!: 'text' | 'image';

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;
}

export class AdminRefundListDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  page?: string;

  @IsOptional()
  @IsString()
  pageSize?: string;
}
