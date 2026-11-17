import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import type { ApiResp, AuthResponse } from '@shared/api.interface';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto): Promise<ApiResp<AuthResponse>> {
    const data = await this.authService.register(dto);
    return { success: true, data, message: '注册成功' };
  }

  @Post('login')
  async login(@Body() dto: LoginDto): Promise<ApiResp<AuthResponse>> {
    const data = await this.authService.login(dto);
    return { success: true, data, message: '登录成功' };
  }
}
