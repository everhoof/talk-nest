import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PubSub } from 'graphql-subscriptions';
import { IsNull } from 'typeorm';
import { RoleResources, roles } from '../../app.roles';
import { User } from '@modules/users/entities/users.entity';
import { BadRequestException, ForbiddenException } from '@modules/common/exceptions/exceptions';
import { Utils } from '@modules/common/utils/utils';
import { Message, MessageSchema, MessageType } from './entities/messages.entity';
import { PollVotesRepository } from './repositories/poll-votes.repository';
import { MessagesRepository } from './repositories/messages.repository';
import { MessagesService } from './messages.service';
import { CreatePollArgs, Poll, VotePollArgs } from './polls.types';

@Injectable()
export class PollsService {
  constructor(
    @InjectRepository(MessagesRepository) private readonly messages: MessagesRepository,
    @InjectRepository(PollVotesRepository) private readonly votes: PollVotesRepository,
    private readonly messagesService: MessagesService,
    @Inject('PUB_SUB') private readonly pubSub: PubSub,
  ) {}

  async createPoll(args: CreatePollArgs, user: User): Promise<Message> {
    if (!roles.can(user.roleNames).createOwn(RoleResources.POLL).granted) {
      throw new ForbiddenException('FORBIDDEN');
    }
    await this.messagesService.throwOnPunished(user.id);
    const question = args.question.trim();
    const options = args.options.map((option) => option.trim());
    if (
      !question ||
      question.length > 300 ||
      options.length < 2 ||
      options.length > 10 ||
      options.some((option) => !option || option.length > 100) ||
      new Set(options.map((option) => option.toLowerCase())).size !== options.length
    ) {
      throw new BadRequestException('POLL_INVALID');
    }
    const message = await this.messages.saveAndReturn(
      this.messages.create({
        ownerId: user.id,
        username: user.username,
        content: '',
        randomId: Utils.getRandomString(32),
        type: MessageType.POLL,
        schema: MessageSchema.POLL,
        json: JSON.stringify({ question, options }),
        pictures: [],
      }),
    );
    await this.pubSub.publish('messageCreated', { messageCreated: message });
    return message;
  }

  async getPoll(messageId: number, user?: User): Promise<Poll> {
    const message = await this.messages.findOne({ where: { id: messageId, deletedAt: IsNull() } });
    if (!message || message.type !== MessageType.POLL || !message.json) {
      throw new BadRequestException('MESSAGE_NOT_FOUND');
    }
    const { question, options } = JSON.parse(message.json);
    const poll: Poll = {
      messageId,
      question,
      selectedOption: null,
      totalVotes: null,
      options: options.map((label: string) => ({ label, votes: null })),
    };
    // Results stay private until this viewer has voted, including direct GraphQL requests.
    if (!user) return poll;
    const ownVote = await this.votes.findOne({ messageId, userId: user.id });
    if (!ownVote) return poll;
    const counts = await this.votes.getOptionCounts(messageId);
    poll.selectedOption = ownVote.optionIndex;
    poll.totalVotes = 0;
    poll.options.forEach((option) => {
      option.votes = 0;
    });
    for (const count of counts) {
      poll.options[count.optionIndex].votes = count.votes;
      poll.totalVotes += count.votes;
    }
    return poll;
  }

  async votePoll(args: VotePollArgs, user: User): Promise<Poll> {
    const message = await this.votes.addVote(args.messageId, user.id, args.optionIndex);
    await this.pubSub.publish('messageUpdated', { messageUpdated: message });
    return this.getPoll(message.id, user);
  }
}
