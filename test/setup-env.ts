// Integration tests must explicitly target a disposable database.
const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl) throw new Error('Set TEST_DATABASE_URL to a disposable PostgreSQL database ending in _test.');
const database = new URL(databaseUrl);
if (!database.pathname.endsWith('_test')) throw new Error('Integration database names must end in _test.');

Object.assign(process.env, {
  NODE_ENV: 'test',
  CDN_URL: 'https://cdn.example.invalid/',
  TYPEORM_HOST: database.hostname,
  TYPEORM_PORT: database.port || '5432',
  TYPEORM_USERNAME: decodeURIComponent(database.username),
  TYPEORM_PASSWORD: decodeURIComponent(database.password),
  TYPEORM_DATABASE: database.pathname.slice(1),
  TYPEORM_SCHEMA: 'public',
  TYPEORM_MIGRATIONS_RUN: 'true',
  EMAIL_TRANSPORT: 'json://',
  EMAIL_DISPLAY_NAME: 'API tests',
  EMAIL_DISPLAY_EMAIL: 'api@example.invalid',
  UPLOAD_ALLOWED_MIMES: 'image/png,image/jpeg',
  UPLOAD_IMAGE_MAX_SIZE: '1048576',
});
