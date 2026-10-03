import { EntityRepository } from 'typeorm';
import { BasicRepository } from '@modules/common/repositories/basic.repository';
import { BadRequestException } from '@modules/common/exceptions/exceptions';
import { Message, MessageType } from '../entities/messages.entity';
import { PollVote } from '../entities/poll-votes.entity';

@EntityRepository(PollVote)
export class PollVotesRepository extends BasicRepository<PollVote> {
  async getOptionCounts(messageId: number): Promise<{ optionIndex: number; votes: number }[]> {
    const counts = await this.createQueryBuilder('vote')
      .select('vote.optionIndex', 'optionIndex')
      .addSelect('COUNT(*)', 'votes')
      .where({ messageId })
      .groupBy('vote.optionIndex')
      .getRawMany<{ optionIndex: number; votes: string }>();
    return counts.map((count) => ({ optionIndex: count.optionIndex, votes: Number(count.votes) }));
  }

  async addVote(messageId: number, userId: number, optionIndex: number): Promise<Message> {
    return this.manager.transaction(async (manager) => {
      const poll = await manager.findOne(Message, messageId, { lock: { mode: 'pessimistic_write' } });
      if (!poll || poll.type !== MessageType.POLL || poll.deletedAt || !poll.json) {
        throw new BadRequestException('MESSAGE_NOT_FOUND');
      }
      const { options } = JSON.parse(poll.json);
      if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= options.length) {
        throw new BadRequestException('POLL_INVALID');
      }
      const existingVote = await manager.findOne(PollVote, { messageId, userId });
      if (existingVote) throw new BadRequestException('POLL_ALREADY_VOTED');
      await manager.insert(PollVote, { messageId, userId, optionIndex });
      poll.updatedAt = new Date();
      return manager.save(Message, poll);
    });
  }
}
