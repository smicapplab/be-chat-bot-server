import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";

export class SqsUtil {

    private static sqsClient = new SQSClient({
        region: "ap-southeast-1",
        credentials: {
            accessKeyId: process.env.PRI_AWS_ACCESS_KEY,
            secretAccessKey: process.env.PRI_AWS_SECRET_KEY,
        },
    });

    static async sendSQSMessage(
        dto: any,
        action: string,
        queueUrl: string,
        delaySeconds?: number
    ): Promise<Boolean> {
        try {
            const params = {
                QueueUrl: queueUrl,
                MessageBody: JSON.stringify({
                    action,
                    data: dto
                }),
                ...(delaySeconds ? { DelaySeconds: delaySeconds } : {}),
            };

            await this.sqsClient.send(new SendMessageCommand(params));
            return true;
        } catch (error) {
            console.error(error);
            throw error;
        }
    }
}