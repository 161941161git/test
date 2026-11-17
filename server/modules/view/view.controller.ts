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
    // 入口 HTML 只缓存 60 秒：既能省掉一次跨网往返，又能在发布新版本后较快生效
    res.setHeader('Cache-Control', 'public, max-age=60');
    return res.sendFile(file);
  }
}
