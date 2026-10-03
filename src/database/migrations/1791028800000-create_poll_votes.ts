import { MigrationInterface, QueryRunner, Table, TableCheck, TableForeignKey } from 'typeorm';

export class CreatePollVotes1791028800000 implements MigrationInterface {
  name = 'CreatePollVotes1791028800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'poll_votes',
        columns: [
          {
            name: 'message_id',
            type: 'int',
          },
          {
            name: 'user_id',
            type: 'int',
          },
          {
            name: 'option_index',
            type: 'int',
          },
        ],
      }),
    );
    await queryRunner.createPrimaryKey('poll_votes', ['message_id', 'user_id']);
    await queryRunner.createForeignKey(
      'poll_votes',
      new TableForeignKey({
        name: 'poll_votes_foreign_message_id',
        columnNames: ['message_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'messages',
        onDelete: 'CASCADE',
      }),
    );
    await queryRunner.createForeignKey(
      'poll_votes',
      new TableForeignKey({
        name: 'poll_votes_foreign_user_id',
        columnNames: ['user_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
      }),
    );
    await queryRunner.createCheckConstraint(
      'poll_votes',
      new TableCheck({
        name: 'poll_votes_check_option_index',
        expression: 'option_index >= 0 AND option_index < 10',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('poll_votes');
  }
}
