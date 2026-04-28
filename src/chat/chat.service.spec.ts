import { Test, TestingModule } from '@nestjs/testing';
import { ChatService } from './chat.service';
import { DatabaseService } from '../database/database.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

jest.mock('openai');

describe('ChatService', () => {
  let service: ChatService;
  let databaseService: any;
  let cacheManager: any;
  let configService: any;

  const mockKnex = {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    whereIn: jest.fn().mockReturnThis(),
    first: jest.fn(),
    insert: jest.fn().mockReturnThis(),
    returning: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    orderByRaw: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    join: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    raw: jest.fn((str) => str),
  };

  beforeEach(async () => {
    databaseService = {
      getKnex: jest.fn().mockReturnValue(mockKnex),
    };
    cacheManager = {
      get: jest.fn(),
      set: jest.fn(),
    };
    configService = {
      get: jest.fn((key: string) => {
        if (key === 'OPENAI_API_KEY') return 'test-key';
        return null;
      }),
    };

    // Mock dynamic import
    (global as any).Function = jest.fn().mockReturnValue(() => Promise.resolve({
      pipeline: jest.fn().mockResolvedValue(jest.fn().mockResolvedValue({ data: new Float32Array(1024).fill(0.1) })),
      env: { allowRemoteModels: true }
    }));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: DatabaseService, useValue: databaseService },
        { provide: CACHE_MANAGER, useValue: cacheManager },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
    // Force model initialization if needed or wait for it
    await (service as any).initializeModel();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('cleanText', () => {
    it('should remove HTML tags and extra spaces', () => {
      const input = '  <p>Hello   World!</p>  ';
      expect(service.cleanText(input)).toBe('Hello World!');
    });
  });

  describe('generateEmbedding', () => {
    it('should generate an embedding array', async () => {
      const embedding = await service.generateEmbedding('question', 'answer');
      expect(embedding).toHaveLength(1024);
      expect(embedding[0]).toBeCloseTo(0.1);
    });
  });
});
