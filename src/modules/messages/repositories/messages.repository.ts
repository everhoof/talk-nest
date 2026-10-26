import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { BasicRepository } from '@modules/common/repositories/basic.repository';
import { BadRequestException } from '@modules/common/exceptions/exceptions';
import { Message, MessageType } from '@modules/messages/entities/messages.entity';
import { MessagePoll } from '../entities/polls.entity';

@Injectable()
export class MessagesRepository extends BasicRepository<Message> {
  constructor(@InjectEntityManager() manager: EntityManager) {
    super(Message, manager);
  }

  async getPollForUpdate(messageId: number): Promise<{ message: Message; poll: MessagePoll }> {
    const message = await this.manager.findOne(Message, {
      where: { id: messageId },
      lock: { mode: 'pessimistic_write' },
    });
    const poll = await this.manager.findOneBy(MessagePoll, { messageId });

    if (!message || message.type !== MessageType.POLL || message.deletedAt || !poll) {
      throw new BadRequestException('MESSAGE_NOT_FOUND');
    }

    return { message, poll };
  }
}
