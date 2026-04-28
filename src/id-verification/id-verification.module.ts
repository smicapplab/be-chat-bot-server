import { Module } from '@nestjs/common';
import { IdVerificationService } from './id-verification.service';
import { IdVerificationController } from './id-verification.controller';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [AuthModule],
  providers: [IdVerificationService],
  controllers: [IdVerificationController]
})

export class IdVerificationModule {
  
}
