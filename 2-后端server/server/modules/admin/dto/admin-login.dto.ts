import { IsString, IsNotEmpty, MinLength } from 'class-validator';
import type { AdminLoginRequest } from '@shared/api.interface';

export class AdminLoginDto implements AdminLoginRequest {
  @IsString()
  @IsNotEmpty({ message: '用户名不能为空' })
  username!: string;

  @IsString()
  @IsNotEmpty({ message: '密码不能为空' })
  @MinLength(4, { message: '密码至少 4 位' })
  password!: string;
}
