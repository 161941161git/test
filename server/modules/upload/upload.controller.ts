import { Controller, Post, Req, UploadedFile, UseInterceptors, HttpCode, HttpStatus } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import { mkdirSync } from 'fs';

/**
 * 图片上传：存到本地 uploads 目录，返回可直接访问的绝对地址。
 * 说明：Render 免费实例的磁盘是临时的，重新部署后旧图片会丢失；
 * 需要长期保存请换成对象存储（S3/R2 等）并把返回地址改成对应 CDN 域名。
 */
@Controller('api/upload')
export class UploadController {
  @Post()
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const dir = join(process.cwd(), 'uploads');
          mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname || '') || '.png';
          cb(null, `${randomUUID()}${ext}`);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  upload(@UploadedFile() file: { filename: string } | undefined, @Req() req: any) {
    if (!file) {
      return { success: false, message: '没有收到文件' };
    }
    const base =
      process.env.PUBLIC_BASE_URL?.replace(/\/+$/, '') ?? `${req.protocol}://${req.get('host')}`;
    return {
      success: true,
      data: { url: `${base}/uploads/${file.filename}` },
      message: '上传成功',
    };
  }
}
