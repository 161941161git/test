import { Module } from '@nestjs/common';
import { QrConfigService } from './qr-config.service';
import { QrConfigController } from './qr-config.controller';

@Module({
  controllers: [QrConfigController],
  providers: [QrConfigService],
  exports: [QrConfigService],
})
export class QrConfigModule {}
