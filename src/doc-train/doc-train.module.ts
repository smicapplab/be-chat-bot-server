import { Module } from '@nestjs/common';
import { DocTrainService } from './doc-train.service';
import { DocTrainController } from './doc-train.controller';
import { MulterModule } from '@nestjs/platform-express';
import * as multer from 'multer';
import { JwtModule } from '@nestjs/jwt';
import { DatabaseService } from 'src/database/database.service';

@Module({
  imports: [
    MulterModule.register({
      storage: multer.diskStorage({
        destination: './uptrain',
        filename: (req, file, cb) => {
          const uniqueName = file.originalname;
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
  providers: [DocTrainService, DatabaseService],
  controllers: [DocTrainController]
})

export class DocTrainModule { }