import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPollFormatting1793050000000 implements MigrationInterface {
  name = 'AddPollFormatting1793050000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if ('schema' in queryRunner.connection.options) {
      const schema = (queryRunner.connection.options.schema || 'public').replace(/"/g, '""');
      await queryRunner.query(`ALTER TABLE "${schema}".polls ALTER COLUMN question TYPE text`);
      await queryRunner.query(`ALTER TABLE "${schema}".poll_options ALTER COLUMN label TYPE text`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if ('schema' in queryRunner.connection.options) {
      const schema = (queryRunner.connection.options.schema || 'public').replace(/"/g, '""');
      await queryRunner.query(`ALTER TABLE "${schema}".poll_options ALTER COLUMN label TYPE varchar(100)`);
      await queryRunner.query(`ALTER TABLE "${schema}".polls ALTER COLUMN question TYPE varchar(300)`);
    }
  }
}
