import { IsIn, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { USER_ROLES } from '@shared/api.interface';
import type { SwitchRoleRequest, UserRole } from '@shared/api.interface';

export class SwitchRoleDto implements SwitchRoleRequest {
  @IsString()
  @Type(() => String)
  @IsIn(USER_ROLES)
  role!: UserRole;
}
