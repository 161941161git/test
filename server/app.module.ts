import { APP_FILTER } from '@nestjs/core';
import { Module } from '@nestjs/common';

import { DatabaseModule } from './database/database.module';
import { GlobalExceptionFilter } from './common/filters/exception.filter';
import { ViewModule } from './modules/view/view.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { OrdersModule } from './modules/orders/orders.module';
import { ChatModule } from './modules/chat/chat.module';
import { PaymentModule } from './modules/payment/payment.module';
import { QrConfigModule } from './modules/qr-config/qr-config.module';
import { SettlementModule } from './modules/settlement/settlement.module';
import { FundTransactionsModule } from './modules/fund-transactions/fund-transactions.module';
import { AdminModule } from './modules/admin/admin.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { RefundSessionsModule } from './modules/refund-sessions/refund-sessions.module';
import { SupportModule } from './modules/support/support.module';
import { UploadModule } from './modules/upload/upload.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    // 自建数据库连接（Render PostgreSQL）
    DatabaseModule,
    UploadModule,
    HealthModule,
    AuthModule,
    UsersModule,
    OrdersModule,
    ChatModule,
    PaymentModule,
    QrConfigModule,
    SettlementModule,
    FundTransactionsModule,
    NotificationsModule,
    RefundSessionsModule,
    AdminModule,
    SupportModule,

    // 前端路由兜底，必须放在最后
    ViewModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
})
export class AppModule {}
