class Message {
    role: string;
    content: string;
}

export class ChatDto {
    userId?: number | null;
    clientType?: string;
    messages?: Message[];
    newMessage: string;
    isEnhanced: boolean;
    projectId?: number | null;
    sessionId?: number | null;
    topic?: string | null;
    stage?: string | null;
    personality?: string | null;
}