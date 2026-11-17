import { IsBoolean } from 'class-validator';

export class VerifyPaymentDto {
  @IsBoolean()
  verified!: boolean;
}
