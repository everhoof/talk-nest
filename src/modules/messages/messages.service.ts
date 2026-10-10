import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MessagesRepository } from '@modules/messages/repositories/messages.repository';
import { CreateMessageArgs } from '@modules/messages/args/create-message.args';
import { Message, MessageSchema, MessageType } from '@modules/messages/entities/messages.entity';
import { User } from '@modules/users/entities/users.entity';
import { PicturesRepository } from '@modules/pictures/repositories/pictures.repository';
import { GetMessagesArgs } from '@modules/messages/args/get-messages.args';
import {
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
} from '@modules/common/exceptions/exceptions';
import got from 'got';
import { Utils } from '@modules/common/utils/utils';
import { PubSub } from 'graphql-subscriptions';
import { basename } from 'path';
import { UploadService } from '@modules/upload/upload.service';
import { DeleteMessageArgs } from '@modules/messages/args/delete-message.args';
import { FindManyOptions, IsNull, LessThan, LessThanOrEqual, MoreThan, MoreThanOrEqual } from 'typeorm';
import { RoleResources, roles } from '../../app.roles';
import { PunishmentsRepository } from '@modules/users/repositories/punishments.repository';
import { PunishmentTypes } from '@modules/users/args/punishment.args';
import { UpdateMessageArgs } from './args/update-message.args';
import { Service } from '../../tokens';
import { Config } from '@modules/config';
import { UsersRepository } from '@modules/users/repositories/users.repository';
import { OnEvent } from '@nestjs/event-emitter';
import { EventTypes } from '@modules/common/events/event-types';
import { UserLoggedOutEvent } from '@modules/common/events/user/logged-out.event';
import { UserLoggedInEvent } from '@modules/common/events/user/logged-in.event';
import { DonationEvent } from '@modules/common/events/donation/donation.event';

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name, true);

  constructor(
    @Inject(Service.CONFIG) private readonly config: Config,
    @Inject('PUB_SUB') private readonly pubSub: PubSub,
    @InjectRepository(MessagesRepository)
    private readonly messagesRepository: MessagesRepository,
    @InjectRepository(PicturesRepository)
    private readonly picturesRepository: PicturesRepository,
    @InjectRepository(PunishmentsRepository)
    private readonly punishmentsRepository: PunishmentsRepository,
    @InjectRepository(UsersRepository)
    private readonly usersRepository: UsersRepository,
    private readonly uploadService: UploadService,
  ) {}

  async throwOnPunished(targetId: number): Promise<void> {
    const punishment = await this.punishmentsRepository.getLastPunishment(targetId);
    if (!punishment) return;

    if (punishment.type === PunishmentTypes.mute) throw new BadRequestException('YOU_ARE_MUTED');
    if (punishment.type === PunishmentTypes.ban) throw new BadRequestException('YOU_ARE_BANNED');
  }

  async createMessage(args: CreateMessageArgs, user: User): Promise<Message> {
    if (!user.emailConfirmed) throw new ForbiddenException('EMAIL_NOT_CONFIRMED');

    if (!args.content?.trim() && args.pictures.length === 0)
      throw new BadRequestException('CANNOT_CREATE_EMPTY_MESSAGE');

    await this.throwOnPunished(user.id);
    let message = this.messagesRepository.create({
      content: Utils.escapeMessage(args.content?.trim() || ''),
      ownerId: user.id,
      username: user.username?.trim(),
      randomId: args.randomId?.trim(),
      schema: MessageSchema.GENERAL,
      type: MessageType.GENERAL,
    });
    message.pictures = args.pictures.map((id) => this.picturesRepository.create({ id }));
    try {
      message = await this.uploadImagesFromMessage(message, user);
    } catch (e) {
      this.logger.error(e);
    }
    return this.messagesRepository.save(message);
  }

  async updateMessage(args: UpdateMessageArgs, user: User): Promise<Message> {
    if (!user.emailConfirmed) throw new ForbiddenException('EMAIL_NOT_CONFIRMED');

    await this.throwOnPunished(user.id);
    const message = await this.messagesRepository.findOne({ where: { id: args.messageId } });

    if (!args.content) {
      throw new BadRequestException('CANNOT_CREATE_EMPTY_MESSAGE');
    }

    if (!message) {
      throw new BadRequestException('MESSAGE_NOT_FOUND');
    }

    if (message.ownerId != user.id) {
      throw new ForbiddenException('WRONG_MESSAGE_OWNER');
    }

    if (!message.editable) {
      throw new ForbiddenException('MESSAGE_NOT_EDITABLE');
    }

    message.content = Utils.escapeMessage(args.content.trim());
    await this.messagesRepository.save(message);

    return message;
  }

  async createSystemMessage(content: string): Promise<Message> {
    if (!content.trim()) throw new InternalServerErrorException('CANNOT_CREATE_EMPTY_MESSAGE');
    let message = this.messagesRepository.create({
      randomId: Utils.getRandomString(32),
      content: Utils.escapeMessage(content.trim()),
      system: true,
      schema: MessageSchema.SYSTEM,
      type: MessageType.SYSTEM,
    });
    message = await this.messagesRepository.saveAndReturn(message);
    await this.pubSub.publish('messageCreated', { messageCreated: message });
    return message;
  }

  private async uploadImagesFromMessage(message: Message, user: User): Promise<Message> {
    if (!message.content) return message;

    const linkOnlyRegexp = [
      new RegExp(
        `^<p>(https?:\\/\\/(www\\.)?[-a-zA-Zа-яА-Я0-9@:%._+~#=]{1,256}\\.[a-zA-Zа-яА-Я0-9()]{1,6}(\\b|[\\u0400-\\u04FF])([-a-zA-Zа-яА-Я0-9()@:%_+.~#?&/=]*))<\\/p>$`,
        'im',
      ),
      new RegExp(
        `^(https?:\\/\\/(www\\.)?[-a-zA-Zа-яА-Я0-9@:%._+~#=]{1,256}\\.[a-zA-Zа-яА-Я0-9()]{1,6}(\\b|[\\u0400-\\u04FF])([-a-zA-Zа-яА-Я0-9()@:%_+.~#?&/=]*))$`,
        'im',
      ),
    ];
    const linkOnlyEscapedRegexp = [
      new RegExp(
        `^<p>\\\\(https?:\\/\\/(www\\.)?[-a-zA-Zа-яА-Я0-9@:%._+~#=]{1,256}\\.[a-zA-Zа-яА-Я0-9()]{1,6}(\\b|[\\u0400-\\u04FF])([-a-zA-Zа-яА-Я0-9()@:%_+.~#?&/=]*))<\\/p>$`,
        'im',
      ),
      new RegExp(
        `^\\\\(https?:\\/\\/(www\\.)?[-a-zA-Zа-яА-Я0-9@:%._+~#=]{1,256}\\.[a-zA-Zа-яА-Я0-9()]{1,6}(\\b|[\\u0400-\\u04FF])([-a-zA-Zа-яА-Я0-9()@:%_+.~#?&/=]*))$`,
        'im',
      ),
    ];

    let link = linkOnlyEscapedRegexp.reduce((accumulator, regexp) => {
      if (accumulator) {
        return accumulator;
      }

      return message.content.match(regexp);
    }, null);

    if (link) {
      message.content = `<p>${link[1]}</p>`;
      return message;
    }

    link = linkOnlyRegexp.reduce((accumulator, regexp) => {
      if (accumulator) {
        return accumulator;
      }

      return message.content.match(regexp);
    }, null);

    if (!link) return message;

    const headRequest = await got.head(link[1]);
    const mime = headRequest.headers['content-type'];

    if (mime && this.config.UPLOAD_ALLOWED_MIMES.includes(mime)) {
      const getRequest = got.get(link[1]);

      getRequest.on('downloadProgress', (progress) => {
        if (
          (progress.total && progress.total > this.config.EMBED_UPLOAD_IMAGE_MAX_SIZE) ||
          progress.transferred > this.config.EMBED_UPLOAD_IMAGE_MAX_SIZE
        ) {
          getRequest.cancel();
        }
      });

      const buffer = await getRequest.buffer();
      const filename = Utils.getRandomString(32);
      const file: Express.Multer.File = {
        buffer,
        originalname: basename(link[1]),
        filename,
      } as Express.Multer.File;
      const picture = await this.uploadService.uploadPicture(file, user, link[1]);
      console.log(picture);
      message.pictures = [picture];
      message.content = '';
    }

    return message;
  }

  async getMessages(args: GetMessagesArgs, user?: User): Promise<Message[]> {
    let where: FindManyOptions<Message>['where'] = {};
    let order: FindManyOptions<Message>['order'] = { id: 'DESC' };

    if (args.fromDateTime) {
      if (args.reverse) {
        where = { createdAt: LessThanOrEqual(args.fromDateTime) };
      } else {
        where = { createdAt: MoreThanOrEqual(args.fromDateTime) };
        order = { id: 'ASC' };
      }
    } else if (args.lastId) {
      if (args.reverse) {
        where = { id: LessThan(args.lastId) };
      } else {
        where = { id: MoreThan(args.lastId) };
        order = { id: 'ASC' };
      }
    }

    const canReadAny: boolean =
      (user && roles.can(user?.roleNames).readAny(RoleResources.DELETED_MESSAGE).granted) || false;

    let messages: Message[];

    if (canReadAny) {
      messages = await this.messagesRepository.getList(args, {
        where: where,
        order: order,
      });
    } else {
      messages = await this.messagesRepository.getList(args, {
        where: { ...where, deletedAt: IsNull() },
        order: order,
      });
    }

    if (order.id === 'ASC') {
      messages.reverse();
    }

    return messages;
  }

  async deleteMessage(args: DeleteMessageArgs, user: User): Promise<Message> {
    if (!user.emailConfirmed) throw new ForbiddenException('EMAIL_NOT_CONFIRMED');

    const canDeleteAny: boolean = roles.can(user.roleNames).deleteAny('message').granted;
    const canDeleteOwn: boolean = roles.can(user.roleNames).deleteOwn('message').granted;
    if (!args.messageId || (!canDeleteOwn && !canDeleteAny)) throw new BadRequestException('FORBIDDEN');

    const message = await this.messagesRepository.findOne(args.messageId);

    if (!message) throw new BadRequestException('FORBIDDEN');
    if (!canDeleteAny && canDeleteOwn && message.ownerId !== user.id) throw new BadRequestException('FORBIDDEN');

    message.deletedById = user?.id ?? undefined;
    message.deletedAt = new Date();

    return this.messagesRepository.saveAndReturn(message);
  }

  @OnEvent(EventTypes.USER_LOGGED_OUT)
  async createLogOutMessage(payload: UserLoggedOutEvent): Promise<Message> {
    let message = this.messagesRepository.create({
      randomId: Utils.getRandomString(32),
      ownerId: payload.userId,
      username: payload.username,
      content: `вышел из чата`,
      schema: MessageSchema.LOGOUT,
      type: MessageType.LOGOUT,
    });
    message = await this.messagesRepository.saveAndReturn(message);
    await this.pubSub.publish('messageCreated', { messageCreated: message });
    return message;
  }

  @OnEvent(EventTypes.USER_LOGGED_IN)
  async createLogInMessage(payload: UserLoggedInEvent): Promise<Message> {
    let message = this.messagesRepository.create({
      randomId: Utils.getRandomString(32),
      ownerId: payload.userId,
      username: payload.username,
      content: `зашел в чат`,
      schema: MessageSchema.LOGIN,
      type: MessageType.LOGIN,
    });
    message = await this.messagesRepository.saveAndReturn(message);
    await this.pubSub.publish('messageCreated', { messageCreated: message });
    return message;
  }

  @OnEvent(EventTypes.DONATION)
  async createDonationMessage(payload: DonationEvent): Promise<Message> {
    let message = this.messagesRepository.create({
      randomId: Utils.getRandomString(32),
      username: payload.username,
      content: payload.message ?? '',
      schema: MessageSchema.DONATION,
      type: MessageType.DONATION,
      json: payload.toString(),
    });
    message = await this.messagesRepository.saveAndReturn(message);
    await this.pubSub.publish('messageCreated', { messageCreated: message });
    return message;
  }
}
