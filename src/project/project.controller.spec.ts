import { Test, TestingModule } from '@nestjs/testing';
import { ProjectController } from './project.controller';
import { ProjectService } from './project.service';

import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

describe('ProjectController', () => {
  let controller: ProjectController;
  let projectService: any;

  beforeEach(async () => {
    projectService = {
      getAllProjects: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProjectController],
      providers: [
        { provide: ProjectService, useValue: projectService },
        { provide: JwtService, useValue: {} },
        { provide: ConfigService, useValue: {} },
      ],
    }).compile();

    controller = module.get<ProjectController>(ProjectController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
