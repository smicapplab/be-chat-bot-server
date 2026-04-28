import { Test, TestingModule } from '@nestjs/testing';
import { IdVerificationController } from './id-verification.controller';
import { IdVerificationService } from './id-verification.service';

describe('IdVerificationController', () => {
  let controller: IdVerificationController;
  let idVerificationService: any;

  beforeEach(async () => {
    idVerificationService = {
      verifyIdAndCompareFace: jest.fn().mockResolvedValue({ success: true }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [IdVerificationController],
      providers: [
        { provide: IdVerificationService, useValue: idVerificationService },
      ],
    }).compile();

    controller = module.get<IdVerificationController>(IdVerificationController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
