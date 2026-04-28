import { Injectable, OnApplicationShutdown, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Knex from 'knex';
import type { Knex as KnexType } from 'knex';
import knexConfig from '../../knexfile';

let cachedKnex: KnexType | null = null;

@Injectable()
export class DatabaseService implements OnModuleDestroy, OnApplicationShutdown {
    private knex: KnexType;

    constructor(private readonly configService: ConfigService) {
        this.initKnex();
    }

    private initKnex() {
        if (!cachedKnex) {
            const env = this.configService.get<string>('NODE_ENV') || 'development';
            try {
                cachedKnex = Knex(knexConfig[env]);
                console.log(`Knex connection established in ${env} mode`);
            } catch (error) {
                console.error('Error establishing Knex connection:', error);
                throw error;
            }
        }
        this.knex = cachedKnex;
    }

    getKnex(): KnexType {
        if (!this.knex) {
            this.initKnex();
        }
        return this.knex;
    }

    async closeConnection() {
        if (cachedKnex) {
            console.log('Closing Knex connection...');
            await cachedKnex.destroy();
            cachedKnex = null;
            console.log('Knex connection closed');
        }
    }

    async onModuleDestroy(): Promise<void> {
        console.log('onModuleDestroy: Cleaning up Knex connection...');
        await this.closeConnection();
    }

    async onApplicationShutdown(): Promise<void> {
        console.log('onApplicationShutdown: Cleaning up Knex connection...');
        await this.closeConnection();
    }
}
