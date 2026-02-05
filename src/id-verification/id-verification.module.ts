import { Module } from '@nestjs/common';
import { IdVerificationService } from './id-verification.service';
import { IdVerificationController } from './id-verification.controller';

@Module({
  providers: [IdVerificationService],
  controllers: [IdVerificationController]
})

export class IdVerificationModule {
  
}
