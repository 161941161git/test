import { Controller, Get, Res } from '@nestjs/common';
import { existsSync } from 'fs';
import { join } from 'path';
import type { Response } from 'express';

/**
 * 前端单页应用兜底：所有非 /api、非静态资源的路径都返回 index.html。
 */
@Controller()
export class ViewController {
  @Get(['/', '*'])
  render(@Res() res: Response) {
    const file = join(process.cwd(), 'dist/client/index.html');
    if (!existsSync(file)) {
      return res.status(200).send('前端尚未构建：请先执行 npm run build:client');
    }
    return res.sendFile(file);
  }
}
