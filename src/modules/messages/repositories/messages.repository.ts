import { EntityRepository } from 'typeorm';
import { BasicRepository } from '@modules/common/repositories/basic.repository';
import { BadRequestException } from '@modules/common/exceptions/exceptions';
import { Message, MessageType } from '@modules/messages/entities/messages.entity';
import { MessagePoll } from '../entities/polls.entity';

@EntityRepository(Message)
export class MessagesRepository extends BasicRepository<Message> {
  async getPollForUpdate(messageId: number): Promise<{ message: Message; poll: MessagePoll }> {
    const message = await this.manager.findOne(Message, messageId, { lock: { mode: 'pessimistic_write' } });
    const poll = await this.manager.findOne(MessagePoll, { messageId });

    if (!message || message.type !== MessageType.POLL || message.deletedAt || !poll) {
      throw new BadRequestException('MESSAGE_NOT_FOUND');
    }

    return { message, poll };
  }
}
