import { join } from 'path';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { CustomNamingStrategy } from '../modules/common/typeorm/naming-strategy';

export function databaseOptions(seeds = false): PostgresConnectionOptions {
  return {
    type: 'postgres',
    host: process.env.TYPEORM_HOST,
    port: Number(process.env.TYPEORM_PORT || 5432),
    username: process.env.TYPEORM_USERNAME,
    password: process.env.TYPEORM_PASSWORD,
    database: process.env.TYPEORM_DATABASE,
    schema: process.env.TYPEORM_SCHEMA || 'public',
    synchronize: false,
    migrationsRun: !seeds && process.env.TYPEORM_MIGRATIONS_RUN === 'true',
    logging: process.env.TYPEORM_LOGGING === 'true',
    entities: [join(__dirname, '../modules/**/*.entity.{js,ts}')],
    migrations: [join(__dirname, seeds ? 'seeds/*.{js,ts}' : 'migrations/*.{js,ts}')],
    migrationsTableName: seeds ? 'seeds' : 'migrations',
    namingStrategy: new CustomNamingStrategy(),
  };
}
