import { IsString, IsNotEmpty, IsOptional, IsNumber, IsEmail, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { UserDto } from "./user.dto"

export class CreatUserDto {
    @IsOptional()
    @ValidateNested()
    @Type(() => UserDto)
    user?: UserDto

    @IsNumber()
    @IsNotEmpty()
    roleId: number

    @IsOptional()
    @IsString()
    firstName?: string

    @IsOptional()
    @IsString()
    lastName?: string

    @IsOptional()
    @IsEmail()
    email?: string
}