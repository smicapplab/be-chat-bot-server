import { IsString, IsNotEmpty, IsOptional, IsNumber, IsBoolean, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class Message {
    @IsString()
    @IsNotEmpty()
    role: string;

    @IsString()
    @IsNotEmpty()
    content: string;
}

export class ChatDto {
    @IsOptional()
    @IsNumber()
    userId?: number | null;

    @IsOptional()
    @IsString()
    clientType?: string;

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => Message)
    messages?: Message[];

    @IsString()
    @IsNotEmpty()
    newMessage: string;

    @IsBoolean()
    isEnhanced: boolean;

    @IsOptional()
    @IsNumber()
    projectId?: number | null;

    @IsOptional()
    @IsNumber()
    sessionId?: number | null;

    @IsOptional()
    @IsString()
    topic?: string | null;

    @IsOptional()
    @IsString()
    stage?: string | null;

    @IsOptional()
    @IsString()
    personality?: string | null;
}