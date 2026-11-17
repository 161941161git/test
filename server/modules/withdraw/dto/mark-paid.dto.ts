import { IsString, IsNotEmpty } from 'class-validator';

export class MarkPaidDto {
  @IsString()
  @IsNotEmpty()
  adminName!: string;
}
