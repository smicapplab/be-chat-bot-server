import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { CreatUserDto } from './dto/add-user.dto';
import { SearchUserDto } from './dto/search-user';
import { UserDto } from './dto/user.dto';
import { User } from 'src/types/jwt-user.type';
import { ChangePasswordDto } from './dto/change-password.dto';
import { PasswordUtil } from 'src/utils/password-util';

@Injectable()
export class UserService {
    constructor(
        private readonly databaseService: DatabaseService,
    ) { }

    async getUsers(dto: SearchUserDto): Promise<{ users: UserDto[]; total: number; page: number }> {
        const knex = this.databaseService.getKnex();
        const page = dto.page ?? 1;
        const limit = dto.limit ?? 20;
        const offset = (page - 1) * limit;

        try {
            const query = knex('app_user as u')
                .leftJoin('role as r', 'u.role_id', 'r.id')
                .select(
                    'u.id',
                    'u.first_name as firstName',
                    'u.last_name as lastName',
                    'u.email',
                    'u.created_at as createdAt',
                    'r.role_name as roleName'
                )
                .where("is_active", true)
                .orderBy('u.first_name', 'asc')
                .limit(limit)
                .offset(offset);

            // Apply filters if present
            if (dto.name) {
                query.andWhere((qb) => {
                    qb.whereILike('u.first_name', `%${dto.name}%`)
                        .orWhereILike('u.last_name', `%${dto.name}%`);
                });
            }

            if (dto.roleId) {
                query.andWhere('u.role_id', dto.roleId);
            }

            // For counting with filters, reuse the same filters
            const countQuery = knex('app_user as u')
                .count('*')
                .leftJoin('role as r', 'u.role_id', 'r.id');

            if (dto.name) {
                countQuery.andWhere((qb) => {
                    qb.whereILike('u.first_name', `%${dto.name}%`)
                        .orWhereILike('u.last_name', `%${dto.name}%`);
                });
            }

            if (dto.roleId) {
                countQuery.andWhere('u.role_id', dto.roleId);
            }

            const [data, [{ count }]] = await Promise.all([
                query,
                countQuery,
            ]);

            return {
                users: data as UserDto[],
                total: parseInt(count as string, 10),
                page,
            };
        } catch (error) {
            console.error('Error in getUsers:', error);
            throw new Error('Failed to fetch users');
        }
    }

    async addUserByEmail(dto: CreatUserDto) {
        const knex = this.databaseService.getKnex();
        const { user } = dto

        try {
            const existingUser = await knex('app_user')
                .where({ email: user ? dto.user.email : dto.email })
                .first();

            if (existingUser) {
                await knex('app_user')
                    .where({ id: existingUser.id })
                    .update({
                        first_name: user ? user.firstName : dto.firstName,
                        last_name: user ? dto.user.lastName : dto.lastName,
                        role_id: dto.roleId,
                        is_active: true,
                        updated_at: knex.fn.now(),
                    });

                return { message: 'User updated', id: existingUser.id };
            } else {
                const [newUser] = await knex('app_user')
                    .insert({
                        first_name: user ? user.firstName : dto.firstName,
                        last_name: user ? dto.user.lastName : dto.lastName,
                        email: user ? dto.user.email : dto.email,
                        role_id: dto.roleId,
                        created_at: knex.fn.now(),
                        updated_at: knex.fn.now(),
                        password: "",
                        provider: user ? ["Microsoft"] : ["Email"]
                    })
                    .returning(['id']);

                return { message: 'User created', id: newUser.id };
            }
        } catch (error) {
            // Proper error handling/logging as needed
            console.error('addUserByEmail error:', error);
            throw new Error('Error adding or updating user');
        }
    }

    async deactivateUser(userId: number, user: User): Promise<void> {
        const knex = this.databaseService.getKnex();
        try {
            await knex('app_user')
                .where({ id: userId })
                .update({
                    is_active: false,
                    updated_at: knex.fn.now(),
                    updated_by: user.id
                });
        } catch (error) {
            // Proper error handling/logging as needed
            console.error('deactivateUser error:', error);
            throw new Error('Error deactivating user');
        }
    }

    async updateUser(dto: UserDto, user: any): Promise<void> {
        const knex = this.databaseService.getKnex();
        try {
            const { id,
                firstName,
                lastName,
            } = dto;
            await knex('app_user')
                .where({ id })
                .update({
                    first_name: firstName,
                    last_name: lastName,
                    updated_at: knex.fn.now(), 
                    updated_by: user.id
                });

        } catch (error) {
            console.error('Error updating user:', error);
            throw new Error('Failed to update user');
        }
    }

    async changePassword(dto: ChangePasswordDto, tokenUser: any): Promise<void> {

        const { currentPassword, newPassword } = dto;
        // Check for validation errors
        if (!currentPassword || !newPassword) {
            throw new BadRequestException('Both currentPassword and newPassword are required');
        }

        if (currentPassword === newPassword) {
            throw new BadRequestException('New password cannot be the same as the current password');
        }

        const knex = this.databaseService.getKnex();
        const trx = await knex.transaction();

        try {

            const user = await knex('app_user')
                .transacting(trx)
                .where('id', tokenUser.id)
                .first();

            if (!user) {
                throw new NotFoundException('User not found');
            }

            const isPasswordValid = await PasswordUtil.comparePasswords(currentPassword, user.password);
            if (!isPasswordValid) {
                throw new UnauthorizedException('Current Password did not match');
            }

            const hashPassword = newPassword ? await PasswordUtil.hashPassword(newPassword) : null;
            await knex('app_user')
                .transacting(trx)
                .where({ id: user.id })
                .update(
                    {
                        password: hashPassword,
                        updated_at: knex.fn.now(), 
                        updated_by: user.id
                    },
                );

            await trx.commit();
        } catch (error) {
            console.error(error);
            await trx.rollback();
            throw new Error('Failed to change password');
        }
    }

}
