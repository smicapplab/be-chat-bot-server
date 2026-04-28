import { Test, TestingModule } from '@nestjs/testing';
import { UploadService } from './upload.service';
import { DatabaseService } from '../database/database.service';
import * as fs from 'fs';
import * as path from 'path';

jest.mock('fs');

describe('UploadService', () => {
  let service: UploadService;
  let databaseService: any;

  const mockKnex: any = jest.fn(() => mockKnex);
  mockKnex.insert = jest.fn().mockReturnThis();
  mockKnex.returning = jest.fn().mockReturnThis();
  mockKnex.update = jest.fn().mockReturnThis();
  mockKnex.where = jest.fn().mockReturnThis();
  mockKnex.select = jest.fn().mockReturnThis();
  mockKnex.join = jest.fn().mockReturnThis();
  mockKnex.count = jest.fn().mockReturnThis();
  mockKnex.first = jest.fn();
  mockKnex.offset = jest.fn().mockReturnThis();
  mockKnex.limit = jest.fn().mockReturnThis();
  mockKnex.orderBy = jest.fn().mockReturnThis();
  mockKnex.raw = jest.fn((str) => str);
  mockKnex.transaction = jest.fn((cb) => cb(mockKnex));
  mockKnex.del = jest.fn();

  beforeEach(async () => {
    databaseService = {
      getKnex: jest.fn().mockReturnValue(mockKnex),
    };

    // Mock dynamic import
    (global as any).Function = jest.fn().mockReturnValue(() => Promise.resolve({
      pipeline: jest.fn().mockResolvedValue(jest.fn().mockResolvedValue({ data: new Float32Array(1024).fill(0.1) })),
      env: { allowRemoteModels: true }
    }));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UploadService,
        { provide: DatabaseService, useValue: databaseService },
      ],
    }).compile();

    service = module.get<UploadService>(UploadService);
    await (service as any).initializeModel();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('cleanText', () => {
    it('should remove HTML tags and extra spaces', () => {
      const input = '  <div>Data</div>  ';
      expect(service.cleanText(input)).toBe('Data');
    });
  });

  describe('deleteUploadQuestions', () => {
    it('should delete questions and history', async () => {
      mockKnex.del.mockResolvedValue(5);
      const result = await service.deleteUploadQuestions(1);
      expect(result.success).toBe(true);
      expect(mockKnex.transaction).toHaveBeenCalled();
    });
  });
});
