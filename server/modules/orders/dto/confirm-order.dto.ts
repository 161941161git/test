import { IsString, IsNotEmpty } from 'class-validator';

export class ConfirmOrderDto {
  @IsString()
  @IsNotEmpty({ message: '买家ID不能为空' })
  buyerId!: string;
}
