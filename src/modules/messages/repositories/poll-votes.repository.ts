import { EntityRepository, In } from 'typeorm';
import type { PollVoter } from '../polls.types';
import { BasicRepository } from '@modules/common/repositories/basic.repository';
import { BadRequestException, ForbiddenException } from '@modules/common/exceptions/exceptions';
import { Message } from '../entities/messages.entity';
import { MessagePollOption } from '../entities/poll-options.entity';
import { PollVote } from '../entities/poll-votes.entity';
import type { PollOptionCount } from '../types/poll-option-count';
import { MessagesRepository } from './messages.repository';

@EntityRepository(PollVote)
export class PollVotesRepository extends BasicRepository<PollVote> {
  async getOptionCounts(messageId: number): Promise<PollOptionCount[]> {
    const counts = await this.createQueryBuilder('vote')
      .select('vote.optionId', 'optionId')
      .addSelect('COUNT(*)', 'votes')
      .where({ messageId })
      .groupBy('vote.optionId')
      .getRawMany<{ optionId: number; votes: string }>();

    return counts.map((count) => ({ optionId: count.optionId, votes: Number(count.votes) }));
  }

  async getVoterCount(messageId: number): Promise<number> {
    const result = await this.createQueryBuilder('vote')
      .select('COUNT(DISTINCT vote.userId)', 'count')
      .where({ messageId })
      .getRawOne<{ count: string }>();

    return Number(result.count);
  }

  async getVoters(messageId: number): Promise<PollVoter[]> {
    const votes = await this.find({
      where: { messageId },
      relations: ['user', 'user.avatar', 'user.avatar.s'],
      loadEagerRelations: false,
    });

    votes.sort((a, b) => {
      const firstTime = a.votedAt?.getTime() ?? -Infinity;
      const secondTime = b.votedAt?.getTime() ?? -Infinity;
      return firstTime - secondTime || a.userId - b.userId;
    });

    const voters = new Map<number, PollVoter>();
    for (const { userId, user, votedAt, optionId } of votes) {
      if (!user) continue;

      let voter = voters.get(userId);
      if (!voter) {
        voter = {
          id: userId,
          username: user.username || String(userId),
          avatarUrl: user.avatar?.s?.link ?? null,
          votedAt,
          optionIds: [],
        };
        voters.set(userId, voter);
      }
      voter.optionIds.push(optionId);
    }
    return [...voters.values()];
  }

  async hasMultipleSelections(messageId: number): Promise<boolean> {
    const result = await this.createQueryBuilder('vote')
      .select('vote.userId')
      .where({ messageId })
      .groupBy('vote.userId')
      .having('COUNT(*) > 1')
      .limit(1)
      .getRawOne();

    return !!result;
  }

  async addVote(messageId: number, userId: number, optionIds: number[]): Promise<Message> {
    return this.manager.transaction(async (manager) => {
      const messages = manager.getCustomRepository(MessagesRepository);
      const { message, poll } = await messages.getPollForUpdate(messageId);

      if (poll.isClosed) {
        throw new BadRequestException('POLL_CLOSED');
      }

      if (!poll.allowMultiple && optionIds.length > 1) {
        throw new BadRequestException('POLL_INVALID');
      }

      const options = await manager.find(MessagePollOption, { id: In(optionIds), messageId });

      if (options.length !== optionIds.length) {
        throw new BadRequestException('POLL_INVALID');
      }

      const existingVotes = await manager.find(PollVote, { messageId, userId });

      if (existingVotes.length) {
        throw new BadRequestException('POLL_ALREADY_VOTED');
      }

      const votedAt = new Date();
      await manager.insert(
        PollVote,
        optionIds.map((optionId) => ({ messageId, userId, optionId, votedAt })),
      );

      message.updatedAt = new Date();

      return manager.save(Message, message);
    });
  }

  async removeVote(messageId: number, userId: number): Promise<Message> {
    return this.manager.transaction(async (manager) => {
      const messages = manager.getCustomRepository(MessagesRepository);
      const { message, poll } = await messages.getPollForUpdate(messageId);

      if (poll.isClosed) {
        throw new BadRequestException('POLL_CLOSED');
      }

      if (!poll.allowChangeVote) {
        throw new ForbiddenException('FORBIDDEN');
      }

      await manager.delete(PollVote, {
        messageId,
        userId,
      });

      message.updatedAt = new Date();

      return manager.save(Message, message);
    });
  }
}
