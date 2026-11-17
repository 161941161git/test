import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    abortOnError: process.env.NODE_ENV !== 'development',
  });

  const logger = new Logger('Bootstrap');

  // 允许跨域：前端可以部署在与后端不同的域名上
  app.enableCors({
    origin: true,
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id', 'x-admin-token'],
  });

  // 简易身份中继：前端把当前登录用户的 id 放在 x-user-id 请求头里
  app.use((req: any, _res: any, next: () => void) => {
    const raw = req.headers['x-user-id'];
    const userId = Array.isArray(raw) ? raw[0] : raw;
    if (userId && typeof userId === 'string') {
      req.userContext = { userId, userName: '' };
    }
    next();
  });

  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: false }));

  // 本地上传目录（Render 免费实例磁盘是临时的，重启后图片会丢失）
  const uploadDir = join(process.cwd(), 'uploads');
  if (!existsSync(uploadDir)) {
    mkdirSync(uploadDir, { recursive: true });
  }
  app.useStaticAssets(uploadDir, { prefix: '/uploads' });

  // 前端构建产物（与后端同源部署时可直接访问页面）
  const clientDir = join(process.cwd(), 'dist/client');
  if (existsSync(clientDir)) {
    app.useStaticAssets(clientDir, { index: false });
  }

  const port = Number(process.env.PORT || '3000');
  await app.listen(port, '0.0.0.0');
  logger.log(`Server running on 0.0.0.0:${port}`);
  logger.log('API ready at /api');
}

bootstrap();
