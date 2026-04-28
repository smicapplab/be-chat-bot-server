import { Knex } from 'knex';
import { DatabaseService } from 'src/database/database.service';
import { CaseUtil } from 'src/utils/case-util';

export abstract class BaseRepository<T> {
    constructor(
        protected readonly databaseService: DatabaseService,
        protected readonly tableName: string,
    ) { }

    protected get knex(): Knex {
        return this.databaseService.getKnex();
    }

    async findAll(options?: {
        orderBy?: string;
        order?: 'asc' | 'desc';
        limit?: number;
        offset?: number;
    }): Promise<T[]> {
        let query = this.knex(this.tableName).select('*');

        if (options?.orderBy) {
            // Basic validation: only allow alphanumeric, underscores, and dots (for table aliases)
            if (/^[a-z0-9_.]+$/i.test(options.orderBy)) {
                query = query.orderBy(options.orderBy, options.order || 'asc');
            }
        }

        if (options?.limit) {
            query = query.limit(options.limit);
        }

        if (options?.offset) {
            query = query.offset(options.offset);
        }

        const results = await query;
        return CaseUtil.keysToCamelCase(results);
    }

    async findById(id: number | string): Promise<T | null> {
        const result = await this.knex(this.tableName)
            .where({ id })
            .first();

        return result ? CaseUtil.keysToCamelCase(result) : null;
    }

    async findOne(where: Partial<Record<keyof any, any>>): Promise<T | null> {
        const snakeWhere = CaseUtil.keysToSnakeCase(where);
        const result = await this.knex(this.tableName)
            .where(snakeWhere)
            .first();

        return result ? CaseUtil.keysToCamelCase(result) : null;
    }

    async create(data: Partial<T>): Promise<T> {
        const snakeData = CaseUtil.keysToSnakeCase(data);
        const [result] = await this.knex(this.tableName)
            .insert(snakeData)
            .returning('*');

        return CaseUtil.keysToCamelCase(result);
    }

    async update(id: number | string, data: Partial<T>): Promise<T> {
        const snakeData = CaseUtil.keysToSnakeCase(data);
        const [result] = await this.knex(this.tableName)
            .where({ id })
            .update(snakeData)
            .returning('*');

        return CaseUtil.keysToCamelCase(result);
    }

    async delete(id: number | string): Promise<number> {
        return this.knex(this.tableName)
            .where({ id })
            .del();
    }
}
