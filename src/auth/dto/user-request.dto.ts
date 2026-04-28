import { IsString, IsOptional, IsEmail, IsArray } from 'class-validator';

export class UserRequestDto {
    @IsOptional()
    @IsEmail()
    email?: string;

    @IsOptional()
    @IsString()
    firstName?: string;

    @IsOptional()
    @IsString()
    lastName?: string;

    @IsOptional()
    @IsString()
    photo?: string;

    @IsOptional()
    @IsString()
    name?: string;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    provider?: string[];
}