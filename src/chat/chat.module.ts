import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { JwtModule } from '@nestjs/jwt';
import { DatabaseService } from 'src/database/database.service';
import { CacheModule } from '@nestjs/cache-manager';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '1h' },
    }),
    CacheModule.register({
      ttl: 1800,
      max: 100,
      isGlobal: true,
    }),
  ],
  providers: [ChatService, DatabaseService],
  controllers: [ChatController]
})
export class ChatModule { }
