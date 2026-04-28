import { Test, TestingModule } from '@nestjs/testing';
import { ProjectService } from './project.service';
import { DatabaseService } from '../database/database.service';

describe('ProjectService', () => {
  let service: ProjectService;
  let databaseService: any;

  const createQueryBuilderMock = () => {
    const mock: any = jest.fn().mockReturnThis();
    mock.select = jest.fn().mockReturnThis();
    mock.insert = jest.fn().mockReturnThis();
    mock.update = jest.fn().mockReturnThis();
    mock.where = jest.fn().mockReturnThis();
    mock.returning = jest.fn().mockReturnThis();
    mock.orderBy = jest.fn().mockReturnThis();
    mock.join = jest.fn().mockReturnThis();
    mock.groupBy = jest.fn().mockReturnThis();
    mock.del = jest.fn().mockReturnThis();
    mock.then = jest.fn();
    mock.raw = jest.fn((str) => str);
    return mock;
  };

  const mockKnex: any = jest.fn(() => createQueryBuilderMock());
  mockKnex.transaction = jest.fn((cb) => cb(createQueryBuilderMock()));

  beforeEach(async () => {
    databaseService = {
      getKnex: jest.fn().mockReturnValue(mockKnex),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectService,
        { provide: DatabaseService, useValue: databaseService },
      ],
    }).compile();

    service = module.get<ProjectService>(ProjectService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getAllProjects', () => {
    it('should return projects', async () => {
      const qb = createQueryBuilderMock();
      mockKnex.mockReturnValueOnce(qb);
      qb.then.mockImplementation((cb) => cb([{ id: 1, title: 'Project A' }]));

      const result = await service.getAllProjects();
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Project A');
    });
  });

  describe('createProject', () => {
    it('should insert and return new project', async () => {
      const qb = createQueryBuilderMock();
      mockKnex.mockReturnValueOnce(qb);
      qb.returning.mockReturnThis();
      qb.then.mockImplementation((cb) => cb([{ id: 1, title: 'New Project' }]));

      const result = await service.createProject({ title: 'New Project', serviceType: 'Type A', description: 'Desc' });
      expect(result.id).toBe(1);
    });
  });
});
