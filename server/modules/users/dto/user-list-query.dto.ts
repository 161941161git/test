import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

export class UserListQueryDto {
  @IsOptional()
  @Transform(({ obj, key }) => {
    if (obj[key] === 'true') return true;
    if (obj[key] === 'false') return false;
    return obj[key];
  })
  @Type(() => Boolean)
  @IsBoolean()
  isRunner?: boolean;
}
