import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: any;

  beforeEach(async () => {
    authService = {
      loginWithEmail: jest.fn().mockResolvedValue({ success: true, jwt: 'token' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('loginWithEmail', () => {
    it('should return token', async () => {
      const result = await controller.loginWithEmail({ email: 't@ex.com', password: 'p' });
      expect(result.jwt).toBe('token');
    });
  });
});
