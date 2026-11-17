import { Controller, Get, Post, Body } from '@nestjs/common';

import { QrConfigService } from './qr-config.service';
import type { ApiResp, QrConfig, SaveQrConfigRequest } from '@shared/api.interface';

@Controller('api/qr-config')
export class QrConfigController {
  constructor(private readonly qrConfigService: QrConfigService) {}

  @Get()
  async getConfig(): Promise<ApiResp<QrConfig>> {
    const data = await this.qrConfigService.getConfig();
    return { success: true, data, message: 'ok' };
  }

  @Post()
  async saveConfig(@Body() dto: SaveQrConfigRequest): Promise<ApiResp<QrConfig>> {
    const data = await this.qrConfigService.saveConfig(dto);
    return { success: true, data, message: '保存成功' };
  }
}
