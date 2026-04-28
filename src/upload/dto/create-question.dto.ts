import { IsString, IsNotEmpty } from 'class-validator';

export class CreateQuestionDto {
    @IsString()
    @IsNotEmpty()
    fileName: string;

    @IsString()
    @IsNotEmpty()
    data: string;
}