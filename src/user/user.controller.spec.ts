import { Test, TestingModule } from '@nestjs/testing';
import { UserController } from './user.controller';
import { UserService } from './user.service';

import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

describe('UserController', () => {
  let controller: UserController;
  let userService: any;

  beforeEach(async () => {
    userService = {
      getUsers: jest.fn().mockResolvedValue({ users: [], total: 0 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        { provide: UserService, useValue: userService },
        { provide: JwtService, useValue: {} },
        { provide: ConfigService, useValue: {} },
      ],
    }).compile();

    controller = module.get<UserController>(UserController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
