import { MigrationInterface, QueryRunner } from 'typeorm';

function plainText(html: string): string {
  const entities: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0' };
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (entity, code: string) => {
      if (!code.startsWith('#')) return entities[code.toLowerCase()] ?? entity;
      const hex = code[1].toLowerCase() === 'x';
      const point = parseInt(code.slice(hex ? 2 : 1), hex ? 16 : 10);
      return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : entity;
    });
}

export class AddPollFormatting1793050000000 implements MigrationInterface {
  name = 'AddPollFormatting1793050000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if ('schema' in queryRunner.connection.options) {
      const schema = (queryRunner.connection.options.schema || 'public').replace(/"/g, '""');
      await queryRunner.query(`ALTER TABLE "${schema}".polls ALTER COLUMN question TYPE text`);
      await queryRunner.query(`ALTER TABLE "${schema}".poll_options ALTER COLUMN label TYPE text`);
      await queryRunner.query(
        `UPDATE "${schema}".polls SET question = replace(replace(replace(question, '&', '&amp;'), '<', '&lt;'), '>', '&gt;')`,
      );
      await queryRunner.query(
        `UPDATE "${schema}".poll_options SET label = replace(replace(replace(label, '&', '&amp;'), '<', '&lt;'), '>', '&gt;')`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if ('schema' in queryRunner.connection.options) {
      const schema = (queryRunner.connection.options.schema || 'public').replace(/"/g, '""');
      const polls = await queryRunner.query(`SELECT message_id, question FROM "${schema}".polls`);
      for (const poll of polls) {
        const question = plainText(poll.question);
        if (question.length > 300) throw new Error('Cannot restore polls.question: text exceeds 300 characters');
        await queryRunner.query(`UPDATE "${schema}".polls SET question = $1 WHERE message_id = $2`, [
          question,
          poll.message_id,
        ]);
      }
      const options = await queryRunner.query(`SELECT id, label FROM "${schema}".poll_options`);
      for (const option of options) {
        const label = plainText(option.label);
        if (label.length > 100) throw new Error('Cannot restore poll_options.label: text exceeds 100 characters');
        await queryRunner.query(`UPDATE "${schema}".poll_options SET label = $1 WHERE id = $2`, [label, option.id]);
      }
      await queryRunner.query(`ALTER TABLE "${schema}".poll_options ALTER COLUMN label TYPE varchar(100)`);
      await queryRunner.query(`ALTER TABLE "${schema}".polls ALTER COLUMN question TYPE varchar(300)`);
    }
  }
}
