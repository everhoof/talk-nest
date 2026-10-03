import { EntityRepository, In, IsNull } from 'typeorm';
import { BasicRepository } from '@modules/common/repositories/basic.repository';
import { BadRequestException } from '@modules/common/exceptions/exceptions';
import { User } from '@modules/users/entities/users.entity';
import { Utils } from '@modules/common/utils/utils';
import { Message, MessageSchema, MessageType } from '../entities/messages.entity';
import { MessagePoll } from '../entities/polls.entity';
import { MessagePollOption } from '../entities/poll-options.entity';
import { PollVote } from '../entities/poll-votes.entity';
import { PollVotesRepository } from './poll-votes.repository';

@EntityRepository(MessagePoll)
export class PollsRepository extends BasicRepository<MessagePoll> {
  async createPoll(
    user: User,
    question: string,
    labels: string[],
    settings: Pick<MessagePoll, 'allowMultiple' | 'allowChangeVote' | 'endsAt'>,
  ): Promise<Message> {
    if (settings.endsAt && settings.endsAt.getTime() <= Date.now())
      throw new BadRequestException('POLL_END_TIME_INVALID');
    return this.manager.transaction(async (manager) => {
      const message = await manager.save(
        Message,
        manager.create(Message, {
          ownerId: user.id,
          username: user.username,
          content: '',
          randomId: Utils.getRandomString(32),
          type: MessageType.POLL,
          schema: MessageSchema.POLL,
          json: null,
          pictures: [],
        }),
      );
      await manager.insert(MessagePoll, { messageId: message.id, question, ...settings });
      await manager.insert(
        MessagePollOption,
        labels.map((label, position) => ({ messageId: message.id, label, position })),
      );
      return message;
    });
  }

  async getPollData(
    messageId: number,
    userId?: number,
  ): Promise<{
    poll: MessagePoll;
    options: MessagePollOption[];
    ownVotes: PollVote[];
    isClosed: boolean;
    totalVotes: number | null;
    counts: { optionId: number; votes: number }[];
  }> {
    return this.manager.transaction('REPEATABLE READ', async (manager) => {
      const message = await manager.findOne(Message, { where: { id: messageId, deletedAt: IsNull() } });
      const poll = await manager.findOne(MessagePoll, { messageId });
      if (!message || message.type !== MessageType.POLL || !poll) {
        throw new BadRequestException('MESSAGE_NOT_FOUND');
      }
      const options = await manager.find(MessagePollOption, { where: { messageId }, order: { position: 'ASC' } });
      const votes = manager.getCustomRepository(PollVotesRepository);
      let ownVotes: PollVote[] = [];
      const isClosed = poll.isClosed;
      let counts: { optionId: number; votes: number }[] = [];
      let totalVotes: number | null = null;
      if (userId !== undefined) ownVotes = await votes.find({ messageId, userId });
      if (ownVotes.length || isClosed) {
        counts = await votes.getOptionCounts(messageId);
        totalVotes = await votes.getVoterCount(messageId);
      }
      return { poll, options, ownVotes, counts, isClosed, totalVotes };
    });
  }

  async updatePoll(
    messageId: number,
    question: string,
    options: { id?: number | null; label: string }[],
    settings: Partial<Pick<MessagePoll, 'allowMultiple' | 'allowChangeVote' | 'endsAt'>>,
  ): Promise<Message> {
    return this.manager.transaction(async (manager) => {
      const message = await manager.findOne(Message, messageId, { lock: { mode: 'pessimistic_write' } });
      const poll = await manager.findOne(MessagePoll, { messageId });
      if (!message || message.type !== MessageType.POLL || message.deletedAt || !poll) {
        throw new BadRequestException('MESSAGE_NOT_FOUND');
      }
      const changedDeadline = settings.endsAt !== undefined && settings.endsAt?.getTime() !== poll.endsAt?.getTime();
      if (changedDeadline) {
        if (poll.isClosed) throw new BadRequestException('POLL_CLOSED');
        if (settings.endsAt && settings.endsAt.getTime() <= Date.now())
          throw new BadRequestException('POLL_END_TIME_INVALID');
      }
      const previousOptions = await manager.find(MessagePollOption, { messageId });
      const previousIds = new Set(previousOptions.map((option) => option.id));
      const retainedIds = options.flatMap((option) => (option.id == null ? [] : [option.id]));
      const hasDuplicateIds = new Set(retainedIds).size !== retainedIds.length;
      const hasForeignIds = retainedIds.some((id) => !previousIds.has(id));
      if (hasDuplicateIds || hasForeignIds) throw new BadRequestException('POLL_INVALID');
      const removedIds = previousOptions
        .filter((option) => !retainedIds.includes(option.id))
        .map((option) => option.id);
      // Deleting an option also deletes its votes through the foreign key.
      if (removedIds.length) await manager.delete(MessagePollOption, { id: In(removedIds) });
      for (const [position, option] of options.entries()) {
        if (option.id != null) {
          await manager.update(MessagePollOption, option.id, { label: option.label, position });
        } else {
          await manager.insert(MessagePollOption, { messageId, label: option.label, position });
        }
      }
      poll.question = question;
      if (poll.allowMultiple && settings.allowMultiple === false) {
        const votes = manager.getCustomRepository(PollVotesRepository);
        if (await votes.hasMultipleSelections(messageId)) throw new BadRequestException('POLL_MULTIPLE_VOTES_EXIST');
      }
      if (settings.allowMultiple !== undefined) poll.allowMultiple = settings.allowMultiple;
      if (settings.allowChangeVote !== undefined) poll.allowChangeVote = settings.allowChangeVote;
      if (settings.endsAt !== undefined) poll.endsAt = settings.endsAt;
      await manager.save(MessagePoll, poll);
      message.updatedAt = new Date();
      return manager.save(Message, message);
    });
  }
  async closePoll(messageId: number): Promise<Message> {
    return this.manager.transaction(async (manager) => {
      const message = await manager.findOne(Message, messageId, { lock: { mode: 'pessimistic_write' } });
      const poll = await manager.findOne(MessagePoll, { messageId });
      if (!message || message.type !== MessageType.POLL || message.deletedAt || !poll) {
        throw new BadRequestException('MESSAGE_NOT_FOUND');
      }
      if (!poll.isClosed) await manager.update(MessagePoll, { messageId }, { closedAt: new Date() });
      message.updatedAt = new Date();
      return manager.save(Message, message);
    });
  }
}
