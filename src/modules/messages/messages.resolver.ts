import { Args, Mutation, Parent, Query, ResolveField, Resolver, Subscription } from '@nestjs/graphql';
import { Inject, UseFilters, UseGuards } from '@nestjs/common';
import { GraphqlExceptionFilter, ThrottlerExceptionFilter } from '@modules/common/filters/http-exception.filter';
import { Picture } from '@modules/pictures/entities/pictures.entity';
import { Message } from '@modules/messages/entities/messages.entity';
import { Loader } from '@intelrug/nestjs-graphql-dataloader';
import DataLoader from 'dataloader';
import { PicturesLoader } from '@modules/pictures/loaders/pictures.loader';
import { MessagesService } from '@modules/messages/messages.service';
import { CreateMessageArgs } from '@modules/messages/args/create-message.args';
import { CurrentUser, GqlAuthGuard, OptionalGqlAuthGuard } from '@modules/common/guards/auth.guard';
import { User } from '@modules/users/entities/users.entity';
import { GetMessagesArgs } from '@modules/messages/args/get-messages.args';
import { UsersLoader } from '@modules/users/loaders/users.loader';
import { PubSub } from 'graphql-subscriptions';
import { DeleteMessageArgs } from '@modules/messages/args/delete-message.args';
import { ACGuard } from '@modules/common/guards/access-control.guard';
import { UpdateMessageArgs } from './args/update-message.args';

@UseFilters(GraphqlExceptionFilter, ThrottlerExceptionFilter)
@Resolver(() => Message)
export class MessagesResolver {
  constructor(@Inject('PUB_SUB') private readonly pubSub: PubSub, private readonly messagesService: MessagesService) {}

  @ResolveField(() => User, { nullable: true })
  async owner(
    @Parent() message: Message,
    @Loader(UsersLoader)
    usersLoader: DataLoader<User['id'], User>,
  ): Promise<Nullable<User>> {
    if (message.ownerId) {
      return usersLoader.load(message.ownerId);
    }
    return null;
  }

  @ResolveField(() => [Picture])
  async pictures(
    @Parent() message: Message,
    @Loader(PicturesLoader)
    picturesLoader: DataLoader<Picture['id'], Picture>,
  ): Promise<(Picture | Error)[]> {
    return picturesLoader.loadMany(message.pictureIds);
  }

  @ResolveField(() => User, { nullable: true })
  async deletedBy(
    @Parent() message: Message,
    @Loader(UsersLoader)
    usersLoader: DataLoader<User['id'], User>,
  ): Promise<Nullable<User>> {
    if (message.deletedById) {
      return usersLoader.load(message.deletedById);
    }
    return null;
  }

  // @Throttle(5, 20)
  @UseGuards(GqlAuthGuard)
  @Mutation(() => Message)
  async updateMessage(@Args() args: UpdateMessageArgs, @CurrentUser() user: User): Promise<Message> {
    const message = await this.messagesService.updateMessage(args, user);
    await this.pubSub.publish('messageUpdated', { messageUpdated: message });
    return message;
  }

  // @Throttle(5, 20)
  // @UseGuards(GqlThrottlerGuard)
  @UseGuards(GqlAuthGuard)
  @Mutation(() => Message)
  async createMessage(@Args() args: CreateMessageArgs, @CurrentUser() user: User): Promise<Message> {
    const message = await this.messagesService.createMessage(args, user);
    await this.pubSub.publish('messageCreated', { messageCreated: message });
    return message;
  }

  @UseGuards(OptionalGqlAuthGuard, ACGuard)
  @Query(() => [Message])
  async getMessages(@Args() args: GetMessagesArgs, @CurrentUser() user?: User): Promise<Message[]> {
    const messages = await this.messagesService.getMessages(args, user);

    if (args.poll && !args.reverse && messages.length === 0) {
      return this.getMessagesPoll();
    }

    return messages;
  }

  private async getMessagesPoll(): Promise<Message[]> {
    const iterator = this.pubSub.asyncIterator('messageCreated');

    setTimeout(() => {
      iterator.return?.();
    }, 60 * 1000);

    const result = await iterator.next();
    if (result.value?.messageCreated) {
      return [result.value.messageCreated];
    } else {
      return [];
    }
  }

  // @Throttle(5, 20)
  @UseGuards(GqlAuthGuard)
  @Mutation(() => Message)
  async deleteMessage(@Args() args: DeleteMessageArgs, @CurrentUser() user: User): Promise<Message> {
    const message = await this.messagesService.deleteMessage(args, user);
    await this.pubSub.publish('messageDeleted', { messageDeleted: message });
    return message;
  }

  @UseGuards(OptionalGqlAuthGuard)
  @Subscription(() => Message, {
    name: 'messageCreated',
  })
  messageCreated(): AsyncIterator<Message> {
    return this.pubSub.asyncIterator('messageCreated');
  }

  @UseGuards(OptionalGqlAuthGuard)
  @Subscription(() => Message, {
    name: 'messageDeleted',
  })
  messageDeleted(): AsyncIterator<Message> {
    return this.pubSub.asyncIterator('messageDeleted');
  }

  @UseGuards(OptionalGqlAuthGuard)
  @Subscription(() => Message, {
    name: 'messageUpdated',
  })
  messageUpdated(): AsyncIterator<Message> {
    return this.pubSub.asyncIterator('messageUpdated');
  }
}
