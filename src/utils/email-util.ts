import { SqsUtil } from "./sqs-util";
export class EmailUtil {

    static async sendEmail(
        dto: {
            to: string[],
            cc?: string[],
            bcc?: string[],
            subject?: string,
            htmlBody?: string,
        }
    ): Promise<Boolean> {
        try {
            await SqsUtil.sendSQSMessage(dto, "send-email", process.env.SQS_EMAIL_QUEUE)
            return true;
        } catch (error) {
            console.error(error);
            throw error;
        }

    }
}