import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePollVotes1791028800000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE poll_votes (
        message_id integer NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
        user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        option_index integer NOT NULL CHECK (option_index >= 0 AND option_index < 10),
        PRIMARY KEY (message_id, user_id)
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE poll_votes');
  }
}
