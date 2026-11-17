import { IsString, Length, Matches } from 'class-validator';
import type { RegisterRequest } from '@shared/api.interface';

export class RegisterDto implements RegisterRequest {
  @IsString()
  @Matches(/^1[3-9]\d{9}$/, { message: '手机号格式不正确' })
  phone!: string;

  @IsString()
  @Length(1, 50)
  name!: string;

  @IsString()
  @Length(1, 50)
  dormitory!: string;
}
