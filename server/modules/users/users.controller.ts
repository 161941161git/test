import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { ApplyRunnerDto } from './dto/apply-runner.dto';
import { SwitchRoleDto } from './dto/switch-role.dto';
import { UserListQueryDto } from './dto/user-list-query.dto';
import { UpdateQrCodesDto } from './dto/update-qr-codes.dto';
import type { ApiResp, User, RunnerApplication, NotificationListResponse } from '@shared/api.interface';

@Controller('api/users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly notificationsService: NotificationsService,
  ) {}

  @Get()
  async list(
    @Query() query: UserListQueryDto,
  ): Promise<ApiResp<{ items: User[]; total: number }>> {
    const data = await this.usersService.list(query);
    return { success: true, data, message: '获取成功' };
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<ApiResp<User>> {
    const data = await this.usersService.findById(id);
    return { success: true, data, message: '获取成功' };
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<ApiResp<User>> {
    const data = await this.usersService.update(id, dto);
    return { success: true, data, message: '更新成功' };
  }

  @Post('apply-runner')
  async applyRunner(@Body() dto: ApplyRunnerDto): Promise<ApiResp<User>> {
    const data = await this.usersService.applyRunner(dto);
    return { success: true, data, message: '申请成功' };
  }

  @Get(':id/latest-application')
  async getLatestApplication(
    @Param('id') id: string,
  ): Promise<ApiResp<RunnerApplication | null>> {
    const data = await this.usersService.getLatestApplication(id);
    return { success: true, data, message: '获取成功' };
  }

  @Get(':id/notifications')
  async getNotifications(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ): Promise<ApiResp<NotificationListResponse>> {
    const data = await this.notificationsService.listByRecipient(
      'user',
      id,
      page ? Number(page) : 1,
      pageSize ? Number(pageSize) : 20,
    );
    return { success: true, data, message: '获取成功' };
  }

  @Post(':id/notifications/read-all')
  async markAllRead(@Param('id') id: string): Promise<ApiResp<{ success: boolean }>> {
    await this.notificationsService.markAllRead('user', id);
    return { success: true, data: { success: true }, message: '已全部标为已读' };
  }

  @Post(':id/notifications/:notifId/read')
  async markOneRead(
    @Param('id') id: string,
    @Param('notifId') notifId: string,
  ): Promise<ApiResp<{ success: boolean }>> {
    await this.notificationsService.markOneRead(notifId, 'user', id);
    return { success: true, data: { success: true }, message: '已标为已读' };
  }

  @Post(':id/switch-role')
  async switchRole(
    @Param('id') id: string,
    @Body() dto: SwitchRoleDto,
  ): Promise<ApiResp<User>> {
    const data = await this.usersService.switchRole(id, dto.role);
    return { success: true, data, message: '角色切换成功' };
  }

  @Post(':id/qr-codes')
  async updateQrCodes(
    @Param('id') id: string,
    @Body() dto: UpdateQrCodesDto,
  ): Promise<ApiResp<User>> {
    const data = await this.usersService.updateQrCodes(
      id,
      dto.wechatQrUrl,
      dto.alipayQrUrl,
    );
    return { success: true, data, message: '收款码更新成功' };
  }
}
