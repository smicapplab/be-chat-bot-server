import { Test, TestingModule } from '@nestjs/testing';
import { DocTrainService } from './doc-train.service';
import { DatabaseService } from '../database/database.service';
import { S3Client } from '@aws-sdk/client-s3';
import { TextractClient } from '@aws-sdk/client-textract';
import { OpenAI } from 'openai';

jest.mock('@aws-sdk/client-s3');
jest.mock('@aws-sdk/client-textract');
jest.mock('openai');
jest.mock('mammoth', () => ({
  extractRawText: jest.fn().mockResolvedValue({ value: 'Extracted text' })
}));

describe('DocTrainService', () => {
  let service: DocTrainService;
  let databaseService: any;

  const createQueryBuilderMock = () => {
    const mock: any = jest.fn().mockReturnThis();
    mock.select = jest.fn().mockReturnThis();
    mock.where = jest.fn().mockReturnThis();
    mock.first = jest.fn();
    mock.insert = jest.fn().mockReturnThis();
    mock.update = jest.fn().mockReturnThis();
    mock.returning = jest.fn().mockReturnThis();
    mock.count = jest.fn().mockReturnThis();
    mock.limit = jest.fn().mockReturnThis();
    mock.offset = jest.fn().mockReturnThis();
    mock.orderBy = jest.fn().mockReturnThis();
    mock.leftJoin = jest.fn().mockReturnThis();
    mock.raw = jest.fn((str) => str);
    mock.then = jest.fn();
    return mock;
  };

  const mockKnex: any = jest.fn(() => createQueryBuilderMock());

  beforeEach(async () => {
    databaseService = {
      getKnex: jest.fn().mockReturnValue(mockKnex),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocTrainService,
        { provide: DatabaseService, useValue: databaseService },
      ],
    }).compile();

    service = module.get<DocTrainService>(DocTrainService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('splitTextForOpenAI', () => {
    it('should split text into chunks of specified word count', () => {
      const text = 'This is a long sentence. Another sentence here.';
      const chunks = (service as any).splitTextForOpenAI(text, 3);
      expect(chunks.length).toBeGreaterThan(1);
    });
  });
});
