import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreatePollVotes1791028800000 implements MigrationInterface {
  name = 'CreatePollVotes1791028800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'polls',
        columns: [
          { name: 'message_id', type: 'int', isPrimary: true },
          { name: 'question', type: 'varchar', length: '300' },
          { name: 'is_anonymous', type: 'boolean', default: false },
          { name: 'allow_multiple', type: 'boolean', default: false },
          { name: 'allow_change_vote', type: 'boolean', default: false },
          { name: 'ends_at', type: 'timestamp with time zone', isNullable: true },
          { name: 'closed_at', type: 'timestamp with time zone', isNullable: true },
        ],
      }),
    );
    await queryRunner.createForeignKey(
      'polls',
      new TableForeignKey({
        name: 'polls_foreign_message_id',
        columnNames: ['message_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'messages',
        onDelete: 'CASCADE',
      }),
    );
    await queryRunner.createTable(
      new Table({
        name: 'poll_options',
        columns: [
          { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
          { name: 'message_id', type: 'int' },
          { name: 'label', type: 'varchar', length: '100' },
          { name: 'position', type: 'int' },
        ],
      }),
    );
    await queryRunner.createIndex(
      'poll_options',
      new TableIndex({ name: 'poll_options_idx_message_id', columnNames: ['message_id'] }),
    );
    await queryRunner.createForeignKey(
      'poll_options',
      new TableForeignKey({
        name: 'poll_options_foreign_message_id',
        columnNames: ['message_id'],
        referencedColumnNames: ['message_id'],
        referencedTableName: 'polls',
        onDelete: 'CASCADE',
      }),
    );
    await queryRunner.createTable(
      new Table({
        name: 'poll_votes',
        columns: [
          { name: 'message_id', type: 'int' },
          { name: 'user_id', type: 'int' },
          { name: 'option_id', type: 'int' },
          {
            name: 'voted_at',
            type: 'timestamp with time zone',
            isNullable: true,
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
    );
    await queryRunner.createPrimaryKey('poll_votes', ['message_id', 'user_id', 'option_id']);
    await queryRunner.createIndex(
      'poll_votes',
      new TableIndex({ name: 'poll_votes_idx_option_id', columnNames: ['option_id'] }),
    );
    await queryRunner.createForeignKey(
      'poll_votes',
      new TableForeignKey({
        name: 'poll_votes_foreign_message_id',
        columnNames: ['message_id'],
        referencedColumnNames: ['message_id'],
        referencedTableName: 'polls',
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
    await queryRunner.createForeignKey(
      'poll_votes',
      new TableForeignKey({
        name: 'poll_votes_foreign_option_id',
        columnNames: ['option_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'poll_options',
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('poll_votes');
    await queryRunner.dropTable('poll_options');
    await queryRunner.dropTable('polls');
  }
}
