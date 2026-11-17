import {
  IsString,
  IsUUID,
  IsIn,
  IsOptional,
  IsBoolean,
} from 'class-validator';
import {
  MESSAGE_TYPES,
  USER_ROLES,
} from '@shared/api.interface';
import type {
  MessageType,
  UserRole,
  SendMessageRequest,
} from '@shared/api.interface';

export class SendMessageDto implements SendMessageRequest {
  @IsUUID()
  @IsString()
  orderId!: string;

  @IsUUID()
  @IsString()
  senderId!: string;

  @IsString()
  @IsIn(USER_ROLES)
  senderRole!: 'buyer' | 'runner';

  @IsString()
  @IsIn(MESSAGE_TYPES)
  msgType!: 'text' | 'image';

  @IsString()
  content!: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsBoolean()
  isDeliveryPhoto?: boolean;
}
