import { PubSub } from 'graphql-subscriptions';
import { BadRequestException, ForbiddenException } from '@modules/common/exceptions/exceptions';
import { User } from '@modules/users/entities/users.entity';
import { AppRoles } from '../../app.roles';
import { PollsRepository } from './repositories/polls.repository';
import { PollVotesRepository } from './repositories/poll-votes.repository';
import { MessagesService } from './messages.service';
import { PollsService } from './polls.service';

describe('PollsService', () => {
  const polls = { createPoll: jest.fn(), getPollData: jest.fn(), updatePoll: jest.fn(), closePoll: jest.fn() };
  const votes = {
    addVote: jest.fn(),
    removeVote: jest.fn(),
  };
  const messagesService = { throwOnPunished: jest.fn() };
  const pubSub = { publish: jest.fn() };
  const user = Object.assign(new User(), { id: 1, username: 'listener', roles: [{ name: AppRoles.USER }] });
  const service = new PollsService(
    (polls as unknown) as PollsRepository,
    (votes as unknown) as PollVotesRepository,
    (messagesService as unknown) as MessagesService,
    (pubSub as unknown) as PubSub,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    polls.createPoll.mockResolvedValue({ id: 10 });
    polls.getPollData.mockResolvedValue({
      poll: { question: 'Что послушаем?', allowMultiple: false, allowChangeVote: false, endsAt: null },
      options: [
        { id: 11, label: 'Рок' },
        { id: 12, label: 'Джаз' },
      ],
      ownVotes: [],
      isClosed: false,
      totalVotes: null,
      counts: [],
    });
  });

  it.each([AppRoles.MODERATOR, AppRoles.BROADCASTER, AppRoles.ADMIN])('allows %s to create a poll', async (role) => {
    const creator = Object.assign(new User(), { id: 2, username: 'host', roles: [{ name: role }] });
    const message = await service.createPoll({ question: '  Тема  ', options: ['  Рок  '] }, creator);
    expect(polls.createPoll).toHaveBeenCalledWith(creator, 'Тема', ['Рок'], {
      allowMultiple: false,
      allowChangeVote: false,
      endsAt: null,
    });
    expect(messagesService.throwOnPunished).toHaveBeenCalledWith(creator.id);
    expect(pubSub.publish).toHaveBeenCalledWith('messageCreated', { messageCreated: message });
  });

  it('rejects creation by an ordinary user', async () => {
    await expect(service.createPoll({ question: 'Тема', options: ['Рок'] }, user)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(polls.createPoll).not.toHaveBeenCalled();
  });

  it('rejects options that differ only by whitespace or case', async () => {
    const creator = Object.assign(new User(), { id: 2, roles: [{ name: AppRoles.MODERATOR }] });
    await expect(service.createPoll({ question: 'Тема', options: ['Рок', ' рок '] }, creator)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(polls.createPoll).not.toHaveBeenCalled();
  });

  it('passes explicit creation settings to the repository', async () => {
    const creator = Object.assign(new User(), { id: 2, roles: [{ name: AppRoles.BROADCASTER }] });
    const settings = { allowMultiple: true, allowChangeVote: true, endsAt: new Date('2030-01-01T12:00:00Z') };
    await service.createPoll({ question: 'Тема', options: ['Рок'], ...settings }, creator);
    expect(polls.createPoll).toHaveBeenCalledWith(creator, 'Тема', ['Рок'], settings);
  });

  it('hides results from guests', async () => {
    expect(await service.getPoll(10)).toMatchObject({
      selectedOption: null,
      totalVotes: null,
      options: [{ votes: null }, { votes: null }],
    });
    expect(polls.getPollData).toHaveBeenCalledWith(10, undefined);
  });

  it('hides results from signed-in users who have not voted', async () => {
    expect(await service.getPoll(10, user)).toMatchObject({
      totalVotes: null,
      options: [{ votes: null }, { votes: null }],
    });
  });

  it('shows results after voting, including options with no votes', async () => {
    const data = await polls.getPollData();
    polls.getPollData.mockResolvedValue({
      ...data,
      ownVotes: [{ optionId: 12 }],
      totalVotes: 3,
      counts: [{ optionId: 12, votes: 3 }],
    });
    expect(await service.getPoll(10, user)).toMatchObject({
      selectedOption: 1,
      totalVotes: 3,
      options: [{ votes: 0 }, { votes: 3 }],
    });
  });

  it('does not publish an update when the repository rejects a repeat vote', async () => {
    votes.addVote.mockRejectedValue(new BadRequestException('POLL_ALREADY_VOTED'));
    await expect(service.votePoll({ messageId: 10, optionIds: [12] }, user)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(pubSub.publish).not.toHaveBeenCalled();
  });

  it('hides results after cancellation and publishes updated counts to subscribers', async () => {
    const message = {
      id: 10,
    };
    votes.removeVote.mockResolvedValue(message);

    const result = await service.cancelPollVote(10, user);

    expect(votes.removeVote).toHaveBeenCalledWith(10, user.id);
    expect(pubSub.publish).toHaveBeenCalledWith('messageUpdated', {
      messageUpdated: message,
    });
    expect(polls.getPollData).toHaveBeenCalledWith(10, user.id);
    expect(result.selectedOptionIds).toEqual([]);
    expect(result.totalVotes).toBeNull();
    expect(result.options.every((option) => option.votes === null)).toBe(true);
  });

  it('does not publish an update when cancellation fails', async () => {
    votes.removeVote.mockRejectedValue(new BadRequestException('POLL_CLOSED'));

    await expect(service.cancelPollVote(10, user)).rejects.toMatchObject({
      exception: 'POLL_CLOSED',
    });
    expect(pubSub.publish).not.toHaveBeenCalled();
    expect(polls.getPollData).not.toHaveBeenCalled();
  });

  it('returns all selected options while keeping the participant count distinct from selections', async () => {
    const data = await polls.getPollData();
    polls.getPollData.mockResolvedValue({
      ...data,
      poll: { ...data.poll, allowMultiple: true },
      ownVotes: [{ optionId: 11 }, { optionId: 12 }],
      totalVotes: 1,
      counts: [
        { optionId: 11, votes: 1 },
        { optionId: 12, votes: 1 },
      ],
    });
    votes.addVote.mockResolvedValue({ id: 10 });
    expect(await service.votePoll({ messageId: 10, optionIds: [11, 12] }, user)).toMatchObject({
      selectedOptionIds: [11, 12],
      totalVotes: 1,
      options: [{ votes: 1 }, { votes: 1 }],
    });
    expect(votes.addVote).toHaveBeenCalledWith(10, user.id, [11, 12]);
    expect(pubSub.publish).toHaveBeenCalledWith('messageUpdated', { messageUpdated: { id: 10 } });
  });

  it('rejects duplicate labels when editing before calling the repository', async () => {
    const editor = Object.assign(new User(), { id: 2, roles: [{ name: AppRoles.MODERATOR }] });
    await expect(
      service.updatePoll(
        { messageId: 10, question: 'Тема', options: [{ id: 11, label: 'Рок' }, { label: ' рок ' }] },
        editor,
      ),
    ).rejects.toMatchObject({ exception: 'POLL_INVALID' });
    expect(polls.updatePoll).not.toHaveBeenCalled();
  });

  it('passes disabled settings and a removed deadline without replacing them with defaults', async () => {
    const editor = Object.assign(new User(), { id: 2, roles: [{ name: AppRoles.BROADCASTER }] });
    await service.updatePoll(
      {
        messageId: 10,
        question: 'Тема',
        options: [{ id: 11, label: 'Рок' }],
        allowMultiple: false,
        allowChangeVote: false,
        endsAt: null,
      },
      editor,
    );
    expect(polls.updatePoll).toHaveBeenCalledWith(10, 'Тема', [{ id: 11, label: 'Рок' }], {
      allowMultiple: false,
      allowChangeVote: false,
      endsAt: null,
    });
  });

  it.each([AppRoles.USER, AppRoles.UNVERIFIED_USER])('rejects poll editing by %s', async (role) => {
    const editor = Object.assign(new User(), { id: 2, roles: [{ name: role }] });
    await expect(
      service.updatePoll({ messageId: 10, question: 'Тема', options: [{ id: 11, label: 'Рок' }] }, editor),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(polls.updatePoll).not.toHaveBeenCalled();
  });

  it.each([AppRoles.BROADCASTER, AppRoles.MODERATOR, AppRoles.ADMIN])(
    "allows %s to edit another user's poll",
    async (role) => {
      const editor = Object.assign(new User(), { id: 2, roles: [{ name: role }] });
      const message = { id: 10, ownerId: 99 };
      polls.updatePoll.mockResolvedValue(message);
      await expect(
        service.updatePoll({ messageId: 10, question: '  Тема  ', options: [{ id: 12, label: '  Рок  ' }] }, editor),
      ).resolves.toEqual(message);
      expect(polls.updatePoll).toHaveBeenCalledWith(10, 'Тема', [{ id: 12, label: 'Рок' }], {
        allowMultiple: undefined,
        allowChangeVote: undefined,
        endsAt: undefined,
      });
      expect(pubSub.publish).toHaveBeenCalledWith('messageUpdated', { messageUpdated: message });
    },
  );
  it('reveals results to guests after a poll ends', async () => {
    const data = await polls.getPollData();
    polls.getPollData.mockResolvedValue({
      ...data,
      isClosed: true,
      totalVotes: 1,
      counts: [{ optionId: 11, votes: 1 }],
    });
    expect(await service.getPoll(10)).toMatchObject({
      isClosed: true,
      totalVotes: 1,
      selectedOptionIds: [],
      options: [{ votes: 1 }, { votes: 0 }],
    });
  });

  it.each([AppRoles.USER, AppRoles.UNVERIFIED_USER])('rejects manual closing by %s', async (role) => {
    const viewer = Object.assign(new User(), { id: 2, roles: [{ name: role }] });
    await expect(service.closePoll(10, viewer)).rejects.toBeInstanceOf(ForbiddenException);
    expect(polls.closePoll).not.toHaveBeenCalled();
  });

  it.each([AppRoles.BROADCASTER, AppRoles.MODERATOR, AppRoles.ADMIN])('allows manual closing by %s', async (role) => {
    const creator = Object.assign(new User(), { id: 2, roles: [{ name: role }] });
    polls.closePoll.mockResolvedValue({ id: 10 });
    await service.closePoll(10, creator);
    expect(polls.closePoll).toHaveBeenCalledWith(10);
    expect(pubSub.publish).toHaveBeenCalledWith('messageUpdated', { messageUpdated: { id: 10 } });
  });
});
