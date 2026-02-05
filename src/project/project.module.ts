import { Module } from '@nestjs/common';
import { ProjectController } from './project.controller';
import { ProjectService } from './project.service';
import { JwtModule } from '@nestjs/jwt';
import { DatabaseService } from 'src/database/database.service';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '1h' },
    }),
  ],
  providers: [ProjectService, DatabaseService],
  controllers: [ProjectController],
})
export class ProjectModule { }

