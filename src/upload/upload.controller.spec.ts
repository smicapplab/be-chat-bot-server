import { Test, TestingModule } from '@nestjs/testing';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';

import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

describe('UploadController', () => {
  let controller: UploadController;
  let uploadService: any;

  beforeEach(async () => {
    uploadService = {
      deleteUploadQuestions: jest.fn().mockResolvedValue({ success: true }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UploadController],
      providers: [
        { provide: UploadService, useValue: uploadService },
        { provide: JwtService, useValue: {} },
        { provide: ConfigService, useValue: {} },
      ],
    }).compile();

    controller = module.get<UploadController>(UploadController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
