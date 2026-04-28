import { Test, TestingModule } from '@nestjs/testing';
import { DocTrainController } from './doc-train.controller';
import { DocTrainService } from './doc-train.service';

import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

describe('DocTrainController', () => {
  let controller: DocTrainController;
  let docTrainService: any;

  beforeEach(async () => {
    docTrainService = {
      getDocTrainings: jest.fn().mockResolvedValue({ trainings: [], total: 0 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DocTrainController],
      providers: [
        { provide: DocTrainService, useValue: docTrainService },
        { provide: JwtService, useValue: {} },
        { provide: ConfigService, useValue: {} },
      ],
    }).compile();

    controller = module.get<DocTrainController>(DocTrainController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
