import { Module } from '@nestjs/common';
import { FundTransactionsService } from './fund-transactions.service';

@Module({
  providers: [FundTransactionsService],
  exports: [FundTransactionsService],
})
export class FundTransactionsModule {}
