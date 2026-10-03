import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PubSub } from 'graphql-subscriptions';
import { IsNull } from 'typeorm';
import { RoleResources, roles } from '../../app.roles';
import { User } from '@modules/users/entities/users.entity';
import { BadRequestException, ForbiddenException } from '@modules/common/exceptions/exceptions';
import { Utils } from '@modules/common/utils/utils';
import { Message, MessageSchema, MessageType } from './entities/messages.entity';
import { MessagesRepository } from './repositories/messages.repository';
import { MessagesService } from './messages.service';
import { CreatePollArgs, Poll, VotePollArgs } from './polls.types';

@Injectable()
export class PollsService {
  constructor(
    @InjectRepository(MessagesRepository) private readonly messages: MessagesRepository,
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
    const ownVotes = user
      ? await this.messages.query('SELECT option_index FROM poll_votes WHERE message_id = $1 AND user_id = $2', [
          messageId,
          user.id,
        ])
      : [];
    const selectedOption: number | null = ownVotes[0]?.option_index ?? null;
    // Results stay private until this viewer has voted, including direct GraphQL requests.
    const counts =
      selectedOption !== null
        ? await this.messages.query(
            'SELECT option_index, count(*)::int AS votes FROM poll_votes WHERE message_id = $1 GROUP BY option_index',
            [messageId],
          )
        : [];
    return {
      messageId,
      question,
      selectedOption,
      totalVotes: selectedOption !== null ? counts.reduce((sum, row) => sum + row.votes, 0) : null,
      options: options.map((label: string, index: number) => ({
        label,
        votes: selectedOption !== null ? counts.find((row) => row.option_index === index)?.votes ?? 0 : null,
      })),
    };
  }

  async votePoll(args: VotePollArgs, user: User): Promise<Poll> {
    const message = await this.messages.manager.transaction(async (manager) => {
      const poll = await manager.findOne(Message, args.messageId, { lock: { mode: 'pessimistic_write' } });
      if (!poll || poll.type !== MessageType.POLL || poll.deletedAt || !poll.json) {
        throw new BadRequestException('MESSAGE_NOT_FOUND');
      }
      const { options } = JSON.parse(poll.json);
      if (!Number.isInteger(args.optionIndex) || args.optionIndex < 0 || args.optionIndex >= options.length) {
        throw new BadRequestException('POLL_INVALID');
      }
      const inserted = await manager.query(
        `INSERT INTO poll_votes (message_id, user_id, option_index) VALUES ($1, $2, $3)
         ON CONFLICT (message_id, user_id) DO NOTHING RETURNING user_id`,
        [poll.id, user.id, args.optionIndex],
      );
      if (inserted.length === 0) throw new BadRequestException('POLL_ALREADY_VOTED');
      poll.updatedAt = new Date();
      return manager.save(Message, poll);
    });
    await this.pubSub.publish('messageUpdated', { messageUpdated: message });
    return this.getPoll(message.id, user);
  }
}
