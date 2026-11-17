import { Controller, Get } from '@nestjs/common';

@Controller('api/health')
export class HealthController {
  @Get()
  check() {
    return { success: true, data: { status: 'ok', time: new Date().toISOString() } };
  }
}
