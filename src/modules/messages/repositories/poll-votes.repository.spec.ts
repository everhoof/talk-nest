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
    expect(manager.insert).toHaveBeenCalledWith(PollVote, [{ messageId: 10, userId: 2, optionId: 11 }]);
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
      { messageId: 10, userId: 2, optionId: 11 },
      { messageId: 10, userId: 2, optionId: 12 },
    ]);
  });

  it('rejects an option outside this poll without deleting the existing ballot', async () => {
    poll.allowMultiple = poll.allowChangeVote = true;
    manager.find.mockResolvedValueOnce([{ id: 11 }]);
    await expect(repository.addVote(10, 2, [11, 99])).rejects.toMatchObject({ exception: 'POLL_INVALID' });
    expect(manager.find).toHaveBeenCalledWith(MessagePollOption, { id: In([11, 99]), messageId: 10 });
    expect(manager.delete).not.toHaveBeenCalled();
    expect(manager.insert).not.toHaveBeenCalled();
  });

  it('rejects a repeat vote when changes are disabled', async () => {
    manager.find.mockResolvedValueOnce([{ id: 11 }]).mockResolvedValueOnce([{ optionId: 12 }]);
    await expect(repository.addVote(10, 2, [11])).rejects.toMatchObject({ exception: 'POLL_ALREADY_VOTED' });
    expect(manager.delete).not.toHaveBeenCalled();
    expect(manager.insert).not.toHaveBeenCalled();
  });

  it('replaces the whole ballot of only the current participant', async () => {
    poll.allowMultiple = poll.allowChangeVote = true;
    manager.find.mockResolvedValueOnce([{ id: 13 }]).mockResolvedValueOnce([{ optionId: 11 }, { optionId: 12 }]);
    await repository.addVote(10, 2, [13]);
    expect(manager.delete).toHaveBeenCalledWith(PollVote, { messageId: 10, userId: 2 });
    expect(manager.delete.mock.invocationCallOrder[0]).toBeLessThan(manager.insert.mock.invocationCallOrder[0]);
    expect(manager.insert).toHaveBeenCalledWith(PollVote, [{ messageId: 10, userId: 2, optionId: 13 }]);
  });
});
