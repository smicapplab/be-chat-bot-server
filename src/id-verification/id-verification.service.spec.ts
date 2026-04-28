import { Test, TestingModule } from '@nestjs/testing';
import { IdVerificationService } from './id-verification.service';
import { ConfigService } from '@nestjs/config';
import { TextractClient } from '@aws-sdk/client-textract';
import { RekognitionClient } from '@aws-sdk/client-rekognition';

jest.mock('@aws-sdk/client-textract');
jest.mock('@aws-sdk/client-rekognition');

describe('IdVerificationService', () => {
  let service: IdVerificationService;
  let configService: any;

  beforeEach(async () => {
    configService = {
      get: jest.fn((key) => {
        if (key === 'PRI_AWS_ACCESS_KEY') return 'key';
        if (key === 'PRI_AWS_SECRET_KEY') return 'secret';
        return 'region';
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IdVerificationService,
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<IdVerificationService>(IdVerificationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
