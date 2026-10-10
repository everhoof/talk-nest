import { In } from 'typeorm';
import { Message, MessageType } from '../entities/messages.entity';
import { MessagePoll } from '../entities/polls.entity';
import { MessagePollOption } from '../entities/poll-options.entity';
import { PollVote } from '../entities/poll-votes.entity';
import { PollVotesRepository } from './poll-votes.repository';
import { MessagesRepository } from './messages.repository';

describe('PollVotesRepository without a database', () => {
  const manager = {
    transaction: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    insert: jest.fn(),
    delete: jest.fn(),
    save: jest.fn(),
    getCustomRepository: jest.fn(),
  };
  const repository = Object.assign(new PollVotesRepository(), { manager });
  let poll: MessagePoll;
  let message: Message;

  beforeEach(() => {
    jest.resetAllMocks();
    poll = Object.assign(new MessagePoll(), {
      messageId: 10,
      allowMultiple: false,
      allowChangeVote: false,
      endsAt: null,
      closedAt: null,
    });
    message = Object.assign(new Message(), { id: 10, type: MessageType.POLL, deletedAt: null });
    manager.transaction.mockImplementation((work) => work(manager));
    manager.getCustomRepository.mockImplementation((repositoryType) => {
      expect(repositoryType).toBe(MessagesRepository);

      return Object.assign(new MessagesRepository(), { manager });
    });
    manager.findOne.mockImplementation(async (entity) => {
      if (entity === Message) return message;
      if (entity === MessagePoll) return poll;
    });
    manager.find.mockImplementation(async (entity) => {
      if (entity === MessagePollOption) return [{ id: 11 }];
      if (entity === PollVote) return [];
    });
    manager.save.mockImplementation(async (_entity, value) => value);
  });

  it('locks the poll message before writing a ballot', async () => {
    expect(await repository.addVote(10, 2, [11])).toBe(message);
    expect(manager.findOne).toHaveBeenCalledWith(Message, 10, { lock: { mode: 'pessimistic_write' } });
    expect(manager.findOne.mock.invocationCallOrder[0]).toBeLessThan(manager.insert.mock.invocationCallOrder[0]);
    expect(manager.insert).toHaveBeenCalledWith(PollVote, [
      { messageId: 10, userId: 2, optionId: 11, votedAt: expect.any(Date) },
    ]);
  });

  it.each([
    { name: 'missing message', message: undefined, poll: { messageId: 10 } },
    { name: 'ordinary message', message: { type: MessageType.GENERAL }, poll: { messageId: 10 } },
    { name: 'deleted message', message: { type: MessageType.POLL, deletedAt: new Date() }, poll: { messageId: 10 } },
    { name: 'missing poll', message: { type: MessageType.POLL }, poll: undefined },
  ])('rejects $name before writing votes', async (records) => {
    manager.findOne.mockResolvedValueOnce(records.message).mockResolvedValueOnce(records.poll);

    await expect(repository.addVote(10, 2, [11])).rejects.toMatchObject({ exception: 'MESSAGE_NOT_FOUND' });
    expect(manager.insert).not.toHaveBeenCalled();
    expect(manager.delete).not.toHaveBeenCalled();
    expect(manager.save).not.toHaveBeenCalled();
  });

  it.each(['manual', 'deadline'])('rejects voting after %s closure', async (reason) => {
    if (reason === 'manual') poll.closedAt = new Date();
    if (reason === 'deadline') poll.endsAt = new Date(Date.now() - 1000);
    await expect(repository.addVote(10, 2, [11])).rejects.toMatchObject({ exception: 'POLL_CLOSED' });
    expect(manager.insert).not.toHaveBeenCalled();
    expect(manager.delete).not.toHaveBeenCalled();
  });

  it('rejects multiple selections when disabled', async () => {
    await expect(repository.addVote(10, 2, [11, 12])).rejects.toMatchObject({ exception: 'POLL_INVALID' });
    expect(manager.insert).not.toHaveBeenCalled();
  });

  it('stores every selection when multiple answers are enabled', async () => {
    poll.allowMultiple = true;
    manager.find.mockResolvedValueOnce([{ id: 11 }, { id: 12 }]).mockResolvedValueOnce([]);
    await repository.addVote(10, 2, [11, 12]);
    expect(manager.insert).toHaveBeenCalledWith(PollVote, [
      { messageId: 10, userId: 2, optionId: 11, votedAt: expect.any(Date) },
      { messageId: 10, userId: 2, optionId: 12, votedAt: expect.any(Date) },
    ]);
    const ballot = manager.insert.mock.calls[0][1];
    expect(ballot[0].votedAt).toEqual(ballot[1].votedAt);
  });

  it('rejects an option outside this poll without deleting the existing ballot', async () => {
    poll.allowMultiple = poll.allowChangeVote = true;
    manager.find.mockResolvedValueOnce([{ id: 11 }]);
    await expect(repository.addVote(10, 2, [11, 99])).rejects.toMatchObject({ exception: 'POLL_INVALID' });
    expect(manager.find).toHaveBeenCalledWith(MessagePollOption, { id: In([11, 99]), messageId: 10 });
    expect(manager.delete).not.toHaveBeenCalled();
    expect(manager.insert).not.toHaveBeenCalled();
  });

  it.each([false, true])('rejects a repeat vote before cancellation with allowChangeVote=%s', async (allowed) => {
    poll.allowChangeVote = allowed;
    manager.find.mockResolvedValueOnce([{ id: 11 }]).mockResolvedValueOnce([{ optionId: 12 }]);
    await expect(repository.addVote(10, 2, [11])).rejects.toMatchObject({ exception: 'POLL_ALREADY_VOTED' });
    expect(manager.delete).not.toHaveBeenCalled();
    expect(manager.insert).not.toHaveBeenCalled();
  });

  it('removes the whole ballot of only the current participant under the message lock', async () => {
    poll.allowMultiple = poll.allowChangeVote = true;
    const result = await repository.removeVote(10, 2);

    expect(result).toBe(message);
    expect(manager.findOne).toHaveBeenCalledWith(Message, 10, {
      lock: {
        mode: 'pessimistic_write',
      },
    });
    expect(manager.findOne.mock.invocationCallOrder[0]).toBeLessThan(manager.delete.mock.invocationCallOrder[0]);
    expect(manager.delete).toHaveBeenCalledWith(PollVote, {
      messageId: 10,
      userId: 2,
    });
    expect(message.updatedAt).toBeInstanceOf(Date);
    expect(manager.save).toHaveBeenCalledWith(Message, message);
    expect(manager.insert).not.toHaveBeenCalled();
  });

  it('rejects cancellation when it is disabled', async () => {
    await expect(repository.removeVote(10, 2)).rejects.toMatchObject({
      exception: 'FORBIDDEN',
    });
    expect(manager.delete).not.toHaveBeenCalled();
    expect(manager.save).not.toHaveBeenCalled();
  });

  it.each(['manual', 'deadline'])('rejects cancellation after %s closure', async (reason) => {
    poll.allowChangeVote = true;

    if (reason === 'manual') {
      poll.closedAt = new Date();
    }

    if (reason === 'deadline') {
      poll.endsAt = new Date(Date.now() - 1000);
    }

    await expect(repository.removeVote(10, 2)).rejects.toMatchObject({
      exception: 'POLL_CLOSED',
    });
    expect(manager.delete).not.toHaveBeenCalled();
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('rejects cancellation in a deleted poll', async () => {
    poll.allowChangeVote = true;
    message.deletedAt = new Date();

    await expect(repository.removeVote(10, 2)).rejects.toMatchObject({
      exception: 'MESSAGE_NOT_FOUND',
    });
    expect(manager.delete).not.toHaveBeenCalled();
  });

  it('allows voting again after cancellation without affecting another participant', async () => {
    poll.allowMultiple = poll.allowChangeVote = true;
    let ballots = [
      {
        messageId: 10,
        userId: 2,
        optionId: 11,
      },
      {
        messageId: 10,
        userId: 2,
        optionId: 12,
      },
      {
        messageId: 10,
        userId: 3,
        optionId: 12,
      },
    ];
    manager.find.mockImplementation(async (entity, criteria) => {
      if (entity === MessagePollOption) {
        return [
          {
            id: 11,
          },
        ];
      }

      return ballots.filter((vote) => vote.messageId === criteria.messageId && vote.userId === criteria.userId);
    });
    manager.delete.mockImplementation(async (_entity, criteria) => {
      ballots = ballots.filter((vote) => vote.messageId !== criteria.messageId || vote.userId !== criteria.userId);
    });
    manager.insert.mockImplementation(async (_entity, votes) => ballots.push(...votes));

    await repository.removeVote(10, 2);
    expect(ballots).toHaveLength(1);
    expect(ballots[0].userId).toBe(3);
    await repository.removeVote(10, 2);
    expect(ballots).toHaveLength(1);
    await repository.addVote(10, 2, [11]);
    expect(ballots).toHaveLength(2);
    expect(ballots[1]).toEqual({
      messageId: 10,
      userId: 2,
      optionId: 11,
      votedAt: expect.any(Date),
    });
  });
});
