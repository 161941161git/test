import { Module } from '@nestjs/common';

import { AdminModule } from '../admin/admin.module';
import { SupportService } from './support.service';
import { SupportController } from './support.controller';

@Module({
  imports: [AdminModule],
  providers: [SupportService],
  controllers: [SupportController],
})
export class SupportModule {}
