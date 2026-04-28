import { IsString, IsNotEmpty, IsOptional, IsNumber, IsEmail, IsDate } from 'class-validator';
import { Type } from 'class-transformer';

export class UserDto {
    @IsOptional()
    @IsNumber()
    id: number;

    @IsEmail()
    @IsNotEmpty()
    email: string;

    @IsString()
    @IsNotEmpty()
    firstName: string;

    @IsString()
    @IsNotEmpty()
    lastName: string;

    @IsOptional()
    @IsString()
    roleName?: string;

    @IsOptional()
    @IsDate()
    @Type(() => Date)
    createdAt?: Date;
}