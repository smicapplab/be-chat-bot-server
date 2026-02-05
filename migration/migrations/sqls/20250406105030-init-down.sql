-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS chat;
DROP TABLE IF EXISTS session;
DROP TABLE IF EXISTS question;
DROP TABLE IF EXISTS upload_history;
DROP TABLE IF EXISTS project;
DROP TABLE IF EXISTS api_key;
DROP TABLE IF EXISTS app_user;
DROP TABLE IF EXISTS role;

-- Drop ENUMs (only if no table is using them)
DROP TYPE IF EXISTS providers;
DROP TYPE IF EXISTS status;

-- Drop Extensions
DROP EXTENSION IF EXISTS vector;
DROP EXTENSION IF EXISTS pg_trgm;
DROP EXTENSION IF EXISTS fuzzystrmatch;