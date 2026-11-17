import { Module, forwardRef } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { PaymentModule } from '@server/modules/payment/payment.module';
import { SettlementModule } from '@server/modules/settlement/settlement.module';
import { NotificationsModule } from '@server/modules/notifications/notifications.module';

@Module({
  imports: [PaymentModule, SettlementModule, forwardRef(() => NotificationsModule)],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
