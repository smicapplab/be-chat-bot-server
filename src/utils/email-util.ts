import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SqsService } from "./sqs-util";

@Injectable()
export class EmailService {
    constructor(
        private readonly sqsService: SqsService,
        private readonly configService: ConfigService,
    ) { }

    async sendEmail(
        dto: {
            to: string[],
            cc?: string[],
            bcc?: string[],
            subject?: string,
            htmlBody?: string,
        }
    ): Promise<Boolean> {
        try {
            const queueUrl = this.configService.get<string>("SQS_EMAIL_QUEUE");
            await this.sqsService.sendSQSMessage(dto, "send-email", queueUrl)
            return true;
        } catch (error) {
            console.error(error);
            throw error;
        }

    }
}