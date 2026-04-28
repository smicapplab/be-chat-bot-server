import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { DatabaseService } from '../database/database.service';

describe('UserService', () => {
  let service: UserService;
  let databaseService: any;

  const createQueryBuilderMock = () => {
    const mock: any = jest.fn().mockReturnThis();
    mock.select = jest.fn().mockReturnThis();
    mock.from = jest.fn().mockReturnThis();
    mock.leftJoin = jest.fn().mockReturnThis();
    mock.where = jest.fn().mockReturnThis();
    mock.andWhere = jest.fn().mockReturnThis();
    mock.orderBy = jest.fn().mockReturnThis();
    mock.limit = jest.fn().mockReturnThis();
    mock.offset = jest.fn().mockReturnThis();
    mock.count = jest.fn().mockReturnThis();
    mock.first = jest.fn().mockReturnThis();
    mock.insert = jest.fn().mockReturnThis();
    mock.update = jest.fn().mockReturnThis();
    mock.returning = jest.fn().mockReturnThis();
    mock.transacting = jest.fn().mockReturnThis();
    mock.then = jest.fn();
    return mock;
  };

  const mockKnex: any = jest.fn(() => createQueryBuilderMock());
  mockKnex.fn = { now: jest.fn(() => 'now') };
  mockKnex.transaction = jest.fn(() => ({
    commit: jest.fn(),
    rollback: jest.fn(),
    ...createQueryBuilderMock()
  }));

  beforeEach(async () => {
    databaseService = {
      getKnex: jest.fn().mockReturnValue(mockKnex),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: DatabaseService, useValue: databaseService },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getUsers', () => {
    it('should return users and total count', async () => {
      const qb1 = createQueryBuilderMock();
      const qb2 = createQueryBuilderMock();
      
      mockKnex.mockReturnValueOnce(qb1).mockReturnValueOnce(qb2);
      
      qb1.then.mockImplementation((cb) => cb([{ id: 1, firstName: 'John' }]));
      qb2.then.mockImplementation((cb) => cb([{ count: '1' }]));
      
      const result = await service.getUsers({ page: 1, limit: 10 });
      expect(result.users).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });
});
