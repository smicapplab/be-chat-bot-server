import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { DatabaseService } from '../database/database.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PasswordUtil } from '../utils/password-util';
import { UnauthorizedException } from '@nestjs/common';

jest.mock('../utils/password-util');

describe('AuthService', () => {
  let service: AuthService;
  let databaseService: any;
  let jwtService: any;
  let configService: any;

  const createQueryBuilderMock = () => {
    const mock: any = jest.fn().mockReturnThis();
    mock.select = jest.fn().mockReturnThis();
    mock.leftJoin = jest.fn().mockReturnThis();
    mock.where = jest.fn().mockReturnThis();
    mock.andWhere = jest.fn().mockReturnThis();
    mock.first = jest.fn();
    mock.insert = jest.fn().mockReturnThis();
    mock.update = jest.fn().mockReturnThis();
    mock.del = jest.fn().mockReturnThis();
    mock.then = jest.fn();
    return mock;
  };

  const mockKnex: any = jest.fn(() => createQueryBuilderMock());
  mockKnex.fn = { now: jest.fn(() => 'now') };

  beforeEach(async () => {
    databaseService = {
      getKnex: jest.fn().mockReturnValue(mockKnex),
    };
    jwtService = {
      sign: jest.fn().mockReturnValue('test-jwt'),
    };
    configService = {
      get: jest.fn((key) => {
        if (key === 'JWT_SECRET') return 'test-secret';
        return null;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: DatabaseService, useValue: databaseService },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('loginWithEmail', () => {
    it('should throw UnauthorizedException if user not found', async () => {
      const qb = createQueryBuilderMock();
      mockKnex.mockReturnValueOnce(qb);
      qb.first.mockResolvedValueOnce(null);

      await expect(service.loginWithEmail({ email: 'none@ex.com', password: 'p' }))
        .rejects.toThrow(UnauthorizedException);
    });

    it('should return jwt if password is valid', async () => {
      const qb = createQueryBuilderMock();
      mockKnex.mockReturnValueOnce(qb);
      qb.first.mockResolvedValueOnce({
        id: 1,
        email: 'test@ex.com',
        password: 'hashed',
        isActive: true,
        provider: '{Email}'
      });
      (PasswordUtil.comparePasswords as jest.Mock).mockResolvedValueOnce(true);

      const result = await service.loginWithEmail({ email: 'test@ex.com', password: 'p' });
      expect(result.success).toBe(true);
      expect(result.jwt).toBe('test-jwt');
    });
  });
});
