import { Global, Module } from '@nestjs/common';
import { SqsService } from './sqs-util';
import { EmailService } from './email-util';

@Global()
@Module({
    providers: [SqsService, EmailService],
    exports: [SqsService, EmailService],
})
export class UtilsModule { }