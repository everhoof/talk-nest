import { Args, Mutation, Parent, Query, ResolveField, Resolver, Subscription } from '@nestjs/graphql';
import { Inject, UseFilters, UseGuards } from '@nestjs/common';
import { GraphqlExceptionFilter, ThrottlerExceptionFilter } from '@modules/common/filters/http-exception.filter';
import { User } from '@modules/users/entities/users.entity';
import { CurrentUser, GqlAuthGuard, OptionalGqlAuthGuard } from '@modules/common/guards/auth.guard';
import { Picture } from '@modules/pictures/entities/pictures.entity';
import { PicturesLoader } from '@modules/pictures/loaders/pictures.loader';
import { Loader } from '@modules/common/graphql/dataloader';
import DataLoader from 'dataloader';
import { PubSub } from 'graphql-subscriptions';
import { UsersService } from '@modules/users/users.service';
import { UseRoles } from '@modules/common/guards/access-control.guard';
import { PunishmentArgs, PunishmentTypes } from '@modules/users/args/punishment.args';
import { UnpunishmentArgs } from '@modules/users/args/unpunishment.args';
import { Punishment } from '@modules/users/entities/punishments.entity';
import { GetUserByIdArgs } from '@modules/users/args/get-user-by-id.args';
import { UpdateAvatarArgs } from '@modules/users/args/update-avatar.args';
import { RoleResources, roles } from '../../app.roles';
import { PunishmentsLoader } from '@modules/users/loaders/punishments.loader';
import { SubscriptionEvents } from '@modules/common/types/subscription-events';
import { SearchUsersArgs } from '@modules/users/args/search-users.args';

@UseFilters(GraphqlExceptionFilter, ThrottlerExceptionFilter)
@Resolver(() => User)
export class UsersResolver {
  constructor(
    @Inject('PUB_SUB') private readonly pubSub: PubSub,
    private readonly usersService: UsersService,
  ) {}

  @ResolveField(() => Picture, { nullable: true })
  async avatar(
    @Parent() user: User,
    @Loader(PicturesLoader)
    picturesLoader: DataLoader<Picture['id'], Picture>,
  ): Promise<Nullable<Picture>> {
    if (user.avatarId) {
      return picturesLoader.load(user.avatarId);
    }
    return null;
  }

  @Query(() => User)
  @UseGuards(GqlAuthGuard)
  async getCurrentUser(@CurrentUser() user: User): Promise<User> {
    await this.pubSub.publish(SubscriptionEvents.USER_UPDATED, user);
    return user;
  }

  /**
   * Перед отправкой проверить имеет ли пользователь доступ к этим данным.<br>
   * Необходимо выполнение хотя бы одного условия:
   * 1. Пользователь - владелец этих данных.
   * 2. У пользователя есть permission readAny('user-settings').<br>
   * Иначе вернуть null
   */
  @ResolveField(() => Boolean, { nullable: true })
  async emailConfirmed(@Parent() parent: User, @CurrentUser() user?: User): Promise<boolean | null> {
    if (user && (roles.can(user.roleNames).readAny(RoleResources.USER_SETTINGS).granted || user.id === parent.id))
      return parent.emailConfirmed;
    return null;
  }

  /**
   * Перед отправкой проверить имеет ли пользователь доступ к этим данным.<br>
   * Необходимо выполнение хотя бы одного условия:
   * 1. Пользователь - владелец этих данных.
   * 2. У пользователя есть permission readAny('user-settings').<br>
   * Иначе вернуть null
   */
  @ResolveField(() => Boolean, { nullable: true })
  async muted(
    @Parent() parent: User,
    @Loader(PunishmentsLoader)
    punishmentsLoader: DataLoader<{ targetId: Punishment['targetId']; type: Punishment['type'] }, Punishment>,
    @CurrentUser() user?: User,
  ): Promise<boolean | null> {
    if (user && (roles.can(user.roleNames).readAny(RoleResources.USER_SETTINGS).granted || user.id === parent.id)) {
      const punishment = await punishmentsLoader.load({ targetId: parent.id, type: PunishmentTypes.mute });
      return !!punishment.id;
    }
    return null;
  }

  @ResolveField(() => String, { nullable: true })
  async email(@Parent() parent: User, @CurrentUser() user?: User): Promise<string | null> {
    if (user && (roles.can(user.roleNames).readAny(RoleResources.USER_SETTINGS).granted || user.id === parent.id)) {
      return parent.email;
    }
    return null;
  }

  @Query(() => User)
  @UseGuards(OptionalGqlAuthGuard)
  async getUserById(@Args() args: GetUserByIdArgs): Promise<User> {
    return this.usersService.getUserById(args);
  }

  @Query(() => [User])
  @UseGuards(OptionalGqlAuthGuard)
  async getOnline(): Promise<User[]> {
    return this.usersService.getOnline();
  }

  @Query(() => [User])
  @UseGuards(GqlAuthGuard)
  async searchUsers(@Args() args: SearchUsersArgs): Promise<User[]> {
    return this.usersService.search(args.query);
  }

  @Mutation(() => Boolean)
  @UseGuards(GqlAuthGuard)
  async updateOnlineStatus(): Promise<boolean> {
    return true;
  }

  @Mutation(() => User)
  @UseGuards(GqlAuthGuard)
  updateAvatar(@Args() args: UpdateAvatarArgs, @CurrentUser() executor: User): Promise<User> {
    return this.usersService.updateAvatar(args, executor);
  }

  @Mutation(() => User)
  @UseRoles({
    resource: RoleResources.MUTE,
    action: 'update',
  })
  @UseGuards(GqlAuthGuard)
  punish(@Args() args: PunishmentArgs, @CurrentUser() executor: User): Promise<User> {
    return this.usersService.punish(args, executor);
  }

  @Mutation(() => User)
  @UseRoles({
    resource: RoleResources.MUTE,
    action: 'update',
  })
  @UseGuards(GqlAuthGuard)
  unpunish(@Args() args: UnpunishmentArgs, @CurrentUser() executor: User): Promise<User> {
    return this.usersService.unpunish(args, executor);
  }

  @Subscription(() => [User], {
    resolve: (value) => value,
  })
  onlineUpdated(): AsyncIterator<User[]> {
    return this.pubSub.asyncIterableIterator(SubscriptionEvents.ONLINE_UPDATED);
  }

  /**
   * [Проверка убрана за ненадобностью, так как все проверки стоят на приватных свойствах, но осталась как пример]<br>
   *
   * Если получено событие USER_UPDATED_PRIVATE, то перед отправкой проверить имеет ли подписчик доступ к этим данным.<br>
   * Необходимо выполнение хотя бы одного условия:
   * 1. Подписчик - владелец этих данных.
   * 2. У подписчика есть permission readAny('user-settings').
   */
  @Subscription(() => User, {
    resolve: (value) => value,
    // filter: (payload, variables, context) => {
    //   return payload[Events.USER_UPDATED_PRIVATE]
    //     ? context?.req?.user &&
    //         (context.req.user.id === payload[Events.USER_UPDATED_PRIVATE].id ||
    //           roles.can(context.req.user.roleNames).readAny(RoleResources.USER_SETTINGS).granted)
    //     : true;
    // },
  })
  @UseGuards(OptionalGqlAuthGuard)
  userUpdated(): AsyncIterator<User> {
    return this.pubSub.asyncIterableIterator(SubscriptionEvents.USER_UPDATED);
  }
}
