import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { UserRepository } from './user.repository';
import { CreatUserDto } from './dto/add-user.dto';
import { SearchUserDto } from './dto/search-user';
import { UserDto } from './dto/user.dto';
import { User } from 'src/types/jwt-user.type';
import { ChangePasswordDto } from './dto/change-password.dto';
import { PasswordUtil } from 'src/utils/password-util';

@Injectable()
export class UserService {
    constructor(
        private readonly userRepository: UserRepository,
    ) { }

    async getUsers(dto: SearchUserDto): Promise<{ users: UserDto[]; total: number; page: number }> {
        const { data, count } = await this.userRepository.getUsers(dto);
        return {
            users: data as UserDto[],
            total: count,
            page: dto.page ?? 1,
        };
    }

    async addUserByEmail(dto: CreatUserDto) {
        const { user } = dto
        const email = user ? dto.user.email : dto.email;

        const existingUser = await this.userRepository.findOne({ email });

        if (existingUser) {
            await this.userRepository.update(existingUser.id, {
                firstName: user ? user.firstName : dto.firstName,
                lastName: user ? dto.user.lastName : dto.lastName,
                roleId: dto.roleId,
                isActive: true,
            });

            return { message: 'User updated', id: existingUser.id };
        } else {
            const newUser = await this.userRepository.create({
                firstName: user ? user.firstName : dto.firstName,
                lastName: user ? dto.user.lastName : dto.lastName,
                email: user ? dto.user.email : dto.email,
                roleId: dto.roleId,
                password: "",
                provider: user ? ["Microsoft"] : ["Email"]
            });

            return { message: 'User created', id: newUser.id };
        }
    }

    async deactivateUser(userId: number, user: User): Promise<void> {
        await this.userRepository.update(userId, {
            isActive: false,
            updatedBy: user.id
        });
    }

    async updateUser(dto: UserDto, user: any): Promise<void> {
        const { id, firstName, lastName } = dto;
        await this.userRepository.update(id, {
            firstName,
            lastName,
            updatedBy: user.id
        });
    }

    async changePassword(dto: ChangePasswordDto, tokenUser: any): Promise<void> {
        const { currentPassword, newPassword } = dto;
        if (!currentPassword || !newPassword) {
            throw new BadRequestException('Both currentPassword and newPassword are required');
        }

        if (currentPassword === newPassword) {
            throw new BadRequestException('New password cannot be the same as the current password');
        }

        const user = await this.userRepository.findById(tokenUser.id);
        if (!user) {
            throw new NotFoundException('User not found');
        }

        const isPasswordValid = await PasswordUtil.comparePasswords(currentPassword, (user as any).password);
        if (!isPasswordValid) {
            throw new UnauthorizedException('Current Password did not match');
        }

        const hashPassword = await PasswordUtil.hashPassword(newPassword);
        await this.userRepository.update(user.id, {
            password: hashPassword,
            updatedBy: user.id
        });
    }

}
