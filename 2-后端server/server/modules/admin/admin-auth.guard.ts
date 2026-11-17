import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AdminService } from './admin.service';

@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(private readonly adminService: AdminService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
      admin?: { adminId: string; username: string; name: string };
      userContext?: { userId: string; userName: string };
    }>();

    const tokenHeader = request.headers['x-admin-token'];
    const token = Array.isArray(tokenHeader) ? tokenHeader[0] : tokenHeader;

    if (!token || typeof token !== 'string') {
      throw new UnauthorizedException('未提供管理员令牌');
    }

    const admin = this.adminService.validateToken(token);
    if (!admin) {
      throw new UnauthorizedException('管理员令牌无效或已过期');
    }

    request.admin = admin;
    request.userContext = {
      userId: `admin_${admin.adminId}`,
      userName: admin.name,
    };
    return true;
  }
}
