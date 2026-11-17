import { IsString, IsNotEmpty } from 'class-validator';

export class AcceptOrderDto {
  @IsString()
  @IsNotEmpty({ message: '跑腿员ID不能为空' })
  runnerId!: string;
}
