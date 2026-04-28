import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { AuthController } from './auth/auth.controller';
import { UploadModule } from './upload/upload.module';
import { ChatModule } from './chat/chat.module';
import { ProjectController } from './project/project.controller';
import { ProjectService } from './project/project.service';
import { ProjectModule } from './project/project.module';
import { UserModule } from './user/user.module';
import { DocTrainModule } from './doc-train/doc-train.module';
import { IdVerificationModule } from './id-verification/id-verification.module';
import { EmbeddingModule } from './embedding/embedding.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EmbeddingModule,
    AuthModule,
    DatabaseModule,
    UploadModule,
    ChatModule,
    ProjectModule,
    UserModule,
    DocTrainModule,
    IdVerificationModule
  ],
  controllers: [AppController, AuthController],
  providers: [AppService, ProjectService],
})
export class AppModule { }
