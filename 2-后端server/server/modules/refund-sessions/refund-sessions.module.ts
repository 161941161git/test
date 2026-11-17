import { Module } from '@nestjs/common';
import { RefundSessionsService } from './refund-sessions.service';
import { RefundSessionsController, AdminRefundSessionsController } from './refund-sessions.controller';
import { AdminModule } from '../admin/admin.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [AdminModule, NotificationsModule],
  controllers: [RefundSessionsController, AdminRefundSessionsController],
  providers: [RefundSessionsService],
  exports: [RefundSessionsService],
})
export class RefundSessionsModule {}
