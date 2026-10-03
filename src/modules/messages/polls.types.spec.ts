import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { CreatePollArgs, UpdatePollArgs, VotePollArgs } from './polls.types';

describe('Poll argument validation', () => {
  const pipe = new ValidationPipe();
  const question = 'Что послушаем?';

  it.each([1, 20])('accepts a poll with %i options', async (count) => {
    const options = Array.from({ length: count }, (_, index) => `Вариант ${index + 1}`);
    await expect(
      pipe.transform({ question, options }, { type: 'body', metatype: CreatePollArgs }),
    ).resolves.toBeDefined();
  });

  it.each([
    { question, options: [] },
    { question, options: Array(21).fill('Вариант') },
    { question: ' '.repeat(5), options: ['Рок'] },
    { question: 'x'.repeat(301), options: ['Рок'] },
    { question, options: [' '] },
    { question, options: ['x'.repeat(101)] },
    { question, options: [123] },
  ])('rejects invalid poll input: %j', async (input) => {
    await expect(pipe.transform(input, { type: 'body', metatype: CreatePollArgs })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it.each([1, 1000])('accepts option ID %i', async (optionId) => {
    await expect(
      pipe.transform({ messageId: 1, optionIds: [optionId] }, { type: 'body', metatype: VotePollArgs }),
    ).resolves.toBeDefined();
  });

  it.each([-1, 0, 1.5])('rejects option ID %s', async (optionId) => {
    await expect(
      pipe.transform({ messageId: 1, optionIds: [optionId] }, { type: 'body', metatype: VotePollArgs }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('accepts editing with existing and new options', async () => {
    await expect(
      pipe.transform(
        { messageId: 1, question, options: [{ id: 1, label: 'Рок' }, { label: 'Джаз' }] },
        { type: 'body', metatype: UpdatePollArgs },
      ),
    ).resolves.toBeDefined();
  });

  it.each([
    { options: [{ id: 0, label: 'Рок' }] },
    { options: [{ id: 1.5, label: 'Рок' }] },
    { options: [{ label: ' ' }] },
    { options: [{ label: 'x'.repeat(101) }] },
    { options: [{ label: 123 }] },
    { options: [] },
    { options: Array(21).fill({ label: 'Рок' }) },
  ])('rejects invalid edit options: %j', async ({ options }) => {
    await expect(
      pipe.transform({ messageId: 1, question, options }, { type: 'body', metatype: UpdatePollArgs }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
  it.each([{ optionIds: [] }, { optionIds: [1, 1] }, { optionIds: Array.from({ length: 21 }, (_, i) => i + 1) }])(
    'rejects invalid ballots: %j',
    async ({ optionIds }) => {
      await expect(
        pipe.transform({ messageId: 1, optionIds }, { type: 'body', metatype: VotePollArgs }),
      ).rejects.toBeInstanceOf(BadRequestException);
    },
  );

  it('accepts multiple distinct selections', async () => {
    await expect(
      pipe.transform({ messageId: 1, optionIds: [1, 2] }, { type: 'body', metatype: VotePollArgs }),
    ).resolves.toBeDefined();
  });

  it('accepts explicit settings and a date', async () => {
    await expect(
      pipe.transform(
        { question, options: ['Рок'], allowMultiple: true, allowChangeVote: false, endsAt: new Date() },
        { type: 'body', metatype: CreatePollArgs },
      ),
    ).resolves.toBeDefined();
  });

  it('rejects invalid poll setting types', async () => {
    for (const settings of [{ allowMultiple: 'yes' }, { allowChangeVote: 1 }, { endsAt: 'invalid' }]) {
      await expect(
        pipe.transform({ question, options: ['Рок'], ...settings }, { type: 'body', metatype: CreatePollArgs }),
      ).rejects.toBeInstanceOf(BadRequestException);
    }
  });
});
