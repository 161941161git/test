import { IsArray, IsBoolean, IsString, IsNotEmpty, ArrayMinSize, ValidateNested, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { PACKAGE_SIZES, type CreateOrderRequest, type PackageSize } from '@shared/api.interface';

class CreateOrderPackageDto {
  @IsString()
  @IsNotEmpty({ message: '快递单号不能为空' })
  trackingNo!: string;

  @IsString()
  @IsNotEmpty({ message: '取件手机号不能为空' })
  pickupPhone!: string;

  @IsString()
  @IsIn(PACKAGE_SIZES, { message: '包裹规格无效' })
  @Type(() => String)
  size!: PackageSize;
}

export class CreateOrderDto implements CreateOrderRequest {
  @IsArray()
  @ArrayMinSize(1, { message: '至少需要一个包裹' })
  @ValidateNested({ each: true })
  @Type(() => CreateOrderPackageDto)
  packages!: CreateOrderPackageDto[];

  @IsBoolean()
  isRainy!: boolean;

  @IsBoolean()
  isUrgent!: boolean;

  @IsString()
  @IsNotEmpty({ message: '宿舍地址不能为空' })
  dormitory!: string;

  @IsString()
  @IsNotEmpty({ message: '联系电话不能为空' })
  contactPhone!: string;

  @IsString()
  remark!: string;

  @IsString()
  @IsNotEmpty({ message: '买家ID不能为空' })
  buyerId!: string;
}
