import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PubSub } from 'graphql-subscriptions';
import { RoleResources, roles } from '../../app.roles';
import { User } from '@modules/users/entities/users.entity';
import { BadRequestException, ForbiddenException } from '@modules/common/exceptions/exceptions';
import { Message } from './entities/messages.entity';
import { PollVotesRepository } from './repositories/poll-votes.repository';
import { PollsRepository } from './repositories/polls.repository';
import { MessagesService } from './messages.service';
import { CreatePollArgs, Poll, UpdatePollArgs, VotePollArgs } from './polls.types';

@Injectable()
export class PollsService {
  constructor(
    @InjectRepository(PollsRepository) private readonly polls: PollsRepository,
    @InjectRepository(PollVotesRepository) private readonly votes: PollVotesRepository,
    private readonly messagesService: MessagesService,
    @Inject('PUB_SUB') private readonly pubSub: PubSub,
  ) {}

  async createPoll(args: CreatePollArgs, user: User): Promise<Message> {
    if (!roles.can(user.roleNames).createOwn(RoleResources.POLL).granted) {
      throw new ForbiddenException('FORBIDDEN');
    }

    await this.messagesService.throwOnPunished(user.id);

    const options = this.prepareOptions(args.options);
    const message = await this.polls.createPoll(user, args.question.trim(), options, {
      isAnonymous: args.isAnonymous ?? false,
      allowMultiple: args.allowMultiple ?? false,
      allowChangeVote: args.allowChangeVote ?? false,
      endsAt: args.endsAt ?? null,
    });

    await this.pubSub.publish('messageCreated', { messageCreated: message });

    return message;
  }

  async updatePoll(args: UpdatePollArgs, user: User): Promise<Message> {
    if (!roles.can(user.roleNames).updateAny(RoleResources.POLL).granted) {
      throw new ForbiddenException('FORBIDDEN');
    }

    await this.messagesService.throwOnPunished(user.id);

    const labels = this.prepareOptions(args.options.map((option) => option.label));
    const options = args.options.map((option, index) => ({ id: option.id, label: labels[index] }));
    const message = await this.polls.updatePoll(args.messageId, args.question.trim(), options, {
      allowMultiple: args.allowMultiple ?? undefined,
      allowChangeVote: args.allowChangeVote ?? undefined,
      endsAt: args.endsAt,
    });

    await this.pubSub.publish('messageUpdated', { messageUpdated: message });

    return message;
  }

  private prepareOptions(options: string[]): string[] {
    const labels = options.map((option) => option.trim());
    const normalizedOptions = labels.map((option) => option.toLowerCase());
    const hasDuplicateOptions = new Set(normalizedOptions).size !== normalizedOptions.length;

    if (hasDuplicateOptions) {
      throw new BadRequestException('POLL_INVALID');
    }

    return labels;
  }

  async getPoll(messageId: number, user?: User): Promise<Poll> {
    const canManage = !!user && roles.can(user.roleNames).updateAny(RoleResources.POLL).granted;
    const { poll: record, options, ownVotes, counts, isClosed, totalVotes, voters } = await this.polls.getPollData(
      messageId,
      user?.id,
      canManage,
    );

    const poll: Poll = {
      messageId,
      isAnonymous: record.isAnonymous ?? false,
      closedAt: record.closedAt ?? null,
      voters: canManage && !record.isAnonymous ? voters : [],
      question: record.question,
      allowMultiple: record.allowMultiple,
      allowChangeVote: record.allowChangeVote,
      endsAt: record.endsAt,
      isClosed,
      serverTime: new Date(),
      selectedOptionIds: ownVotes.map((vote) => vote.optionId),
      selectedOption: null,
      totalVotes: null,
      options: options.map(({ id, label }) => ({ id, label, votes: null })),
    };

    // Moderators can preview aggregates; other viewers see results after voting or closure.
    if (!isClosed && !ownVotes.length && !canManage) {
      return poll;
    }

    if (ownVotes.length) {
      poll.selectedOption = options.findIndex((option) => poll.selectedOptionIds.includes(option.id));
    }

    poll.totalVotes = totalVotes;
    const votesByOption = new Map(counts.map((count) => [count.optionId, count.votes]));

    for (const option of poll.options) {
      option.votes = votesByOption.get(option.id) || 0;
    }

    return poll;
  }

  async votePoll(args: VotePollArgs, user: User): Promise<Poll> {
    const message = await this.votes.addVote(args.messageId, user.id, args.optionIds);
    await this.pubSub.publish('messageUpdated', { messageUpdated: message });

    return this.getPoll(message.id, user);
  }

  async cancelPollVote(messageId: number, user: User): Promise<Poll> {
    const message = await this.votes.removeVote(messageId, user.id);
    await this.pubSub.publish('messageUpdated', {
      messageUpdated: message,
    });

    return this.getPoll(message.id, user);
  }

  async closePoll(messageId: number, user: User): Promise<Poll> {
    if (!roles.can(user.roleNames).updateAny(RoleResources.POLL).granted) {
      throw new ForbiddenException('FORBIDDEN');
    }

    await this.messagesService.throwOnPunished(user.id);

    const message = await this.polls.closePoll(messageId);
    await this.pubSub.publish('messageUpdated', { messageUpdated: message });

    return this.getPoll(message.id, user);
  }
}
