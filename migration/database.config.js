/* eslint-disable @typescript-eslint/no-require-imports */
const path = require('path');
const dotenv = require('dotenv');

// Determine current environment (default to 'dev')
const env = process.env.NODE_ENV || 'dev';

// Load the corresponding .env file
dotenv.config({
  path: path.resolve(process.cwd(), `.env.${env}`),
});

module.exports = {
  dev: {
    driver: 'pg',
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    port: parseInt(process.env.DB_PORT || '5432'),
    'sql-file': true,
  },
  prod: {
    driver: 'pg',
    user: process.env.PROD_DB_USER,
    password: process.env.PROD_DB_PASS,
    host: process.env.PROD_DB_HOST,
    database: process.env.PROD_DB_NAME,
    port: parseInt(process.env.PROD_DB_PORT || '5432'),
    'sql-file': true,
  },
  settings: {
    'migration-dir': 'database/migrations',
  },
};

// {
//   "dev": {
//     "driver": "pg",
//     "user": "postgres.skhlxmunlicrffkqcsml",
//     "password": "QahuFPgPgbuPu6co",
//     "host": "aws-0-ap-southeast-1.pooler.supabase.com",
//     "database": "postgres",
//     "port": 5432,
//     "sql-file": true
//   },
//   "prod": {
//     "driver": "pg",
//     "user": "your_prod_user",
//     "password": "your_prod_password",
//     "host": "your-prod-host",
//     "database": "your_prod_db",
//     "port": 5432,
//     "sql-file": true
//   },
//   "settings": {
//     "migration-dir": "database/migrations"
//   }
// }
