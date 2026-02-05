import { Module } from '@nestjs/common';
import { UploadService } from './upload.service';
import { UploadController } from './upload.controller';
import { MulterModule } from '@nestjs/platform-express';
import * as multer from 'multer';
import { JwtModule } from '@nestjs/jwt';
import { DatabaseService } from 'src/database/database.service';

@Module({
  imports: [
    MulterModule.register({
      storage: multer.diskStorage({
        destination: './uploads', 
        filename: (req, file, cb) => {
          const uniqueName = `${Date.now()}-${file.originalname}`;
          cb(null, uniqueName); 
        },
      }),
      limits: {
        fileSize: 10 * 1024 * 1024, 
      },
    }),
    JwtModule.register({
      secret: process.env.JWT_SECRET, 
      signOptions: { expiresIn: '1h' }, 
    }),
  ],
  providers: [UploadService, DatabaseService],
  controllers: [UploadController]
})
export class UploadModule {}
