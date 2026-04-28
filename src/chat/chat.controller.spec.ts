import { Test, TestingModule } from '@nestjs/testing';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

describe('ChatController', () => {
  let controller: ChatController;
  let chatService: any;

  beforeEach(async () => {
    chatService = {
      search: jest.fn().mockResolvedValue({ success: true, response: 'Hi' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChatController],
      providers: [
        { provide: ChatService, useValue: chatService },
        { provide: JwtService, useValue: {} },
        { provide: ConfigService, useValue: {} },
      ],
    }).compile();

    controller = module.get<ChatController>(ChatController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('search', () => {
    it('should return service result', async () => {
      const dto = { newMessage: 'Hello', isEnhanced: false } as any;
      const result: any = await controller.search(dto);
      expect(result.success).toBe(true);
      expect(result.response).toBe('Hi');
    });
  });
});
