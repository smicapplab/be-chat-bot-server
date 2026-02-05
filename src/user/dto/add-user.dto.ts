import { UserDto } from "./user.dto"

export class CreatUserDto {
    user?: UserDto
    roleId: number
    firstName?: string
    lastName?: string
    email?: string
}