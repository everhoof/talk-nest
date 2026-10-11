import { In } from 'typeorm';
import { User } from '@modules/users/entities/users.entity';
import { Message, MessageType } from '../entities/messages.entity';
import { MessagePoll } from '../entities/polls.entity';
import { MessagePollOption } from '../entities/poll-options.entity';
import { PollVotesRepository } from './poll-votes.repository';
import { PollsRepository } from './polls.repository';
import { MessagesRepository } from './messages.repository';

describe('PollsRepository without a database', () => {
  const votes = {
    find: jest.fn(),
    getOptionCounts: jest.fn(),
    getVoterCount: jest.fn(),
    getVoters: jest.fn(),
    hasMultipleSelections: jest.fn(),
  };
  const manager = {
    transaction: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    insert: jest.fn(),
    delete: jest.fn(),
    update: jest.fn(),
    save: jest.fn(),
    getCustomRepository: jest.fn(),
  };
  const repository = Object.assign(new PollsRepository(), { manager });
  const options = [
    { id: 11, label: 'Рок' },
    { id: 12, label: 'Джаз' },
  ];
  let message: Message;
  let poll: MessagePoll;

  beforeEach(() => {
    jest.resetAllMocks();
    message = Object.assign(new Message(), { id: 10, type: MessageType.POLL, deletedAt: null });
    poll = Object.assign(new MessagePoll(), {
      messageId: 10,
      question: 'Тема',
      allowMultiple: false,
      allowChangeVote: false,
      endsAt: null,
      closedAt: null,
    });
    manager.transaction.mockImplementation((isolationOrWork, work) => {
      if (typeof isolationOrWork === 'function') return isolationOrWork(manager);
      return work(manager);
    });
    manager.findOne.mockImplementation(async (entity) => {
      if (entity === Message) return message;
      if (entity === MessagePoll) return poll;
    });
    manager.find.mockResolvedValue(options);
    manager.create.mockImplementation((_entity, value) => value);
    manager.save.mockImplementation(async (_entity, value) => value);
    manager.getCustomRepository.mockImplementation((repositoryType) => {
      if (repositoryType === MessagesRepository) {
        return Object.assign(new MessagesRepository(), { manager });
      }

      expect(repositoryType).toBe(PollVotesRepository);

      return votes;
    });
    votes.find.mockResolvedValue([]);
    votes.getVoters.mockResolvedValue([]);
    votes.getOptionCounts.mockResolvedValue([{ optionId: 11, votes: 1 }]);
    votes.getVoterCount.mockResolvedValue(1);
    votes.hasMultipleSelections.mockResolvedValue(false);
  });

  it('creates separate poll and option records with their settings', async () => {
    manager.save.mockResolvedValueOnce(message);
    const settings = { allowMultiple: true, allowChangeVote: true, endsAt: new Date(Date.now() + 60000) };
    await repository.createPoll(
      Object.assign(new User(), { id: 2, username: 'host' }),
      'Тема',
      ['Рок', 'Джаз'],
      settings,
    );
    expect(manager.create).toHaveBeenCalledWith(
      Message,
      expect.objectContaining({ type: MessageType.POLL, json: null }),
    );
    expect(manager.insert).toHaveBeenCalledWith(MessagePoll, { messageId: 10, question: 'Тема', ...settings });
    expect(manager.insert).toHaveBeenCalledWith(MessagePollOption, [
      { messageId: 10, label: 'Рок', position: 0 },
      { messageId: 10, label: 'Джаз', position: 1 },
    ]);
  });

  it('rejects creation with an expired deadline before starting a transaction', async () => {
    await expect(
      repository.createPoll(new User(), 'Тема', ['Рок'], {
        allowMultiple: false,
        allowChangeVote: false,
        endsAt: new Date(Date.now() - 1000),
      }),
    ).rejects.toMatchObject({ exception: 'POLL_END_TIME_INVALID' });
    expect(manager.transaction).not.toHaveBeenCalled();
  });

  it('does not request vote counts for an active poll before the viewer votes', async () => {
    expect(await repository.getPollData(10, 2)).toMatchObject({ totalVotes: null, counts: [], ownVotes: [] });
    expect(votes.getOptionCounts).not.toHaveBeenCalled();
    expect(votes.getVoterCount).not.toHaveBeenCalled();
  });

  it('loads public results for an expired poll without a signed-in viewer', async () => {
    poll.endsAt = new Date(Date.now() - 1000);
    expect(await repository.getPollData(10)).toMatchObject({
      isClosed: true,
      totalVotes: 1,
      counts: [{ optionId: 11, votes: 1 }],
    });
    expect(votes.find).not.toHaveBeenCalled();
    expect(manager.getCustomRepository).toHaveBeenCalledWith(PollVotesRepository);
    expect(manager.transaction).toHaveBeenCalledWith('REPEATABLE READ', expect.any(Function));
  });

  it('renames and reorders answers by stable IDs without deleting votes or options', async () => {
    await repository.updatePoll(
      10,
      'Новая тема',
      [
        { id: 12, label: 'Джаз!' },
        { id: 11, label: 'Рок!' },
      ],
      {},
    );
    expect(manager.update).toHaveBeenCalledWith(MessagePollOption, 12, { label: 'Джаз!', position: 0 });
    expect(manager.update).toHaveBeenCalledWith(MessagePollOption, 11, { label: 'Рок!', position: 1 });
    expect(manager.findOne).toHaveBeenCalledWith(Message, 10, { lock: { mode: 'pessimistic_write' } });
    expect(manager.findOne.mock.invocationCallOrder[0]).toBeLessThan(manager.update.mock.invocationCallOrder[0]);
    expect(manager.delete).not.toHaveBeenCalled();
    expect(manager.insert).not.toHaveBeenCalled();
  });

  it('deletes only removed option IDs and inserts new answers without reusing an ID', async () => {
    await repository.updatePoll(10, 'Тема', [options[1], { label: 'Поп' }], {});
    expect(manager.delete).toHaveBeenCalledTimes(1);
    expect(manager.delete).toHaveBeenCalledWith(MessagePollOption, { id: In([11]) });
    expect(manager.insert).toHaveBeenCalledWith(MessagePollOption, { messageId: 10, label: 'Поп', position: 1 });
  });

  it.each([
    {
      name: 'duplicate',
      answers: [
        { id: 11, label: 'A' },
        { id: 11, label: 'B' },
      ],
    },
    { name: 'foreign', answers: [{ id: 99, label: 'A' }] },
  ])('rejects $name option IDs before writing changes', async ({ answers }) => {
    await expect(repository.updatePoll(10, 'Тема', answers, {})).rejects.toMatchObject({ exception: 'POLL_INVALID' });
    expect(manager.delete).not.toHaveBeenCalled();
    expect(manager.update).not.toHaveBeenCalled();
    expect(manager.insert).not.toHaveBeenCalled();
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('preserves settings omitted from an edit', async () => {
    poll.allowMultiple = poll.allowChangeVote = true;
    poll.endsAt = new Date(Date.now() + 60000);
    const settings = { allowMultiple: true, allowChangeVote: true, endsAt: poll.endsAt };
    await repository.updatePoll(10, 'Новая тема', options, {});
    expect(manager.save).toHaveBeenCalledWith(MessagePoll, expect.objectContaining(settings));
    expect(votes.hasMultipleSelections).not.toHaveBeenCalled();
  });

  it('rejects disabling multiple answers while retained ballots still have multiple selections', async () => {
    poll.allowMultiple = true;
    votes.hasMultipleSelections.mockResolvedValue(true);
    await expect(repository.updatePoll(10, 'Тема', options, { allowMultiple: false })).rejects.toMatchObject({
      exception: 'POLL_MULTIPLE_VOTES_EXIST',
    });
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('checks retained ballots after deleting options before disabling multiple answers', async () => {
    poll.allowMultiple = true;
    await repository.updatePoll(10, 'Тема', [options[1]], { allowMultiple: false });
    expect(manager.delete).toHaveBeenCalledWith(MessagePollOption, { id: In([11]) });
    expect(manager.delete.mock.invocationCallOrder[0]).toBeLessThan(
      votes.hasMultipleSelections.mock.invocationCallOrder[0],
    );
    expect(manager.save).toHaveBeenCalledWith(MessagePoll, expect.objectContaining({ allowMultiple: false }));
  });

  it.each(['manual', 'deadline'])('rejects extending or removing the deadline after %s closure', async (reason) => {
    if (reason === 'manual') {
      poll.closedAt = new Date();
      poll.endsAt = new Date(Date.now() + 30000);
    }
    if (reason === 'deadline') poll.endsAt = new Date(Date.now() - 1000);
    for (const endsAt of [null, new Date(Date.now() + 60000)]) {
      await expect(repository.updatePoll(10, 'Тема', options, { endsAt })).rejects.toMatchObject({
        exception: 'POLL_CLOSED',
      });
    }
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('rejects changing an active poll deadline to the past', async () => {
    await expect(
      repository.updatePoll(10, 'Тема', options, { endsAt: new Date(Date.now() - 1000) }),
    ).rejects.toMatchObject({ exception: 'POLL_END_TIME_INVALID' });
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('closes an active poll and leaves an already closed poll unchanged', async () => {
    await repository.closePoll(10);
    expect(manager.update).toHaveBeenCalledWith(MessagePoll, { messageId: 10 }, { closedAt: expect.any(Date) });
    expect(manager.findOne).toHaveBeenCalledWith(Message, 10, { lock: { mode: 'pessimistic_write' } });
    manager.update.mockClear();
    poll.closedAt = new Date();
    await repository.closePoll(10);
    expect(manager.update).not.toHaveBeenCalled();
  });

  it.each(['update', 'close'])('rejects a deleted poll on %s before writing changes', async (operation) => {
    message.deletedAt = new Date();
    let action: Promise<Message>;

    if (operation === 'update') {
      action = repository.updatePoll(10, 'Тема', options, {});
    } else {
      action = repository.closePoll(10);
    }

    await expect(action).rejects.toMatchObject({ exception: 'MESSAGE_NOT_FOUND' });
    expect(manager.update).not.toHaveBeenCalled();
    expect(manager.delete).not.toHaveBeenCalled();
    expect(manager.save).not.toHaveBeenCalled();
  });
  it('loads moderator aggregates and voter details without requiring their vote', async () => {
    await repository.getPollData(10, 2, true);
    expect(votes.getOptionCounts).toHaveBeenCalledWith(10);
    expect(votes.getVoterCount).toHaveBeenCalledWith(10);
    expect(votes.getVoters).toHaveBeenCalledWith(10);
  });

  it('does not query identities for anonymous polls, even for moderators', async () => {
    poll.isAnonymous = true;
    await repository.getPollData(10, 2, true);
    expect(votes.getVoterCount).toHaveBeenCalledWith(10);
    expect(votes.getVoters).not.toHaveBeenCalled();
  });

  it('does not query identities for ordinary viewers or guests after closure', async () => {
    poll.closedAt = new Date();
    await repository.getPollData(10, 2);
    await repository.getPollData(10);
    expect(votes.getVoters).not.toHaveBeenCalled();
  });

  it('ignores attempts to change anonymity through editing settings', async () => {
    poll.isAnonymous = true;
    await repository.updatePoll(10, 'Тема', options, { isAnonymous: false } as any);
    expect(poll.isAnonymous).toBe(true);
  });
});

describe('Poll deadline', () => {
  beforeEach(() => jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-04T18:00:00Z')));
  afterEach(() => jest.restoreAllMocks());

  it.each(['2026-10-04T18:00:00Z', '2026-10-04T21:00:00+03:00', '2026-10-04T14:00:00-04:00'])(
    'closes at the same instant regardless of offset: %s',
    (endsAt) => {
      const poll = Object.assign(new MessagePoll(), { endsAt: new Date(endsAt) });
      expect(poll.isClosed).toBe(true);
    },
  );

  it('keeps a future or unscheduled poll open but respects manual closure', () => {
    const poll: MessagePoll = Object.assign(new MessagePoll(), { endsAt: new Date(Date.now() + 1) });
    expect(poll.isClosed).toBe(false);
    poll.endsAt = null;
    expect(poll.isClosed).toBe(false);
    poll.closedAt = new Date();
    expect(poll.isClosed).toBe(true);
  });
});
