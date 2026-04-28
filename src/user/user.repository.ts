import { Injectable } from '@nestjs/common';
import { BaseRepository } from 'src/common/repositories/base.repository';
import { DatabaseService } from 'src/database/database.service';
import { UserDto } from './dto/user.dto';
import { SearchUserDto } from './dto/search-user';

@Injectable()
export class UserRepository extends BaseRepository<any> {
    constructor(databaseService: DatabaseService) {
        super(databaseService, 'app_user');
    }

    async getUsers(dto: SearchUserDto): Promise<{ data: any[]; count: number }> {
        const page = dto.page ?? 1;
        const limit = dto.limit ?? 20;
        const offset = (page - 1) * limit;

        const query = this.knex('app_user as u')
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

        if (dto.name) {
            query.andWhere((qb) => {
                qb.whereILike('u.first_name', `%${dto.name}%`)
                    .orWhereILike('u.last_name', `%${dto.name}%`);
            });
        }

        if (dto.roleId) {
            query.andWhere('u.role_id', dto.roleId);
        }

        const countQuery = this.knex('app_user as u')
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
            data,
            count: parseInt(count as string, 10),
        };
    }
}
