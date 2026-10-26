import { Args, Context, Mutation, Query, Resolver, Subscription } from '@nestjs/graphql';
import { Inject, Req, UseFilters, UseGuards } from '@nestjs/common';
import { GraphqlExceptionFilter, ThrottlerExceptionFilter } from '@modules/common/filters/http-exception.filter';
import { AccountsService } from '@modules/accounts/accounts.service';
import { Token } from '@modules/accounts/entities/tokens.entity';
import { SignInArgs } from '@modules/accounts/args/sign-in.args';
import { User } from '@modules/users/entities/users.entity';
import { SignUpArgs } from '@modules/accounts/args/sign-up.args';
import { ConfirmEmailArgs } from '@modules/accounts/args/confirm-email.args';
import { RequestPasswordResetArgs, ResetPasswordArgs } from '@modules/accounts/args/reset-password.args';
import { CurrentUser, GqlAuthGuard } from '@modules/common/guards/auth.guard';
import { IsUsernameFreeArgs } from '@modules/accounts/args/is-username-free.args';
import { UpdateUsernameArgs } from '@modules/accounts/args/update-username.args';
import { SubscriptionEvents } from '@modules/common/types/subscription-events';
import { PubSub } from 'graphql-subscriptions';
import { AppRoles } from '../../app.roles';
import { GetTokenByDiscordIdArgs } from '@modules/accounts/args/get-token-by-discord-id.args';
import { BadRequestException } from '@modules/common/exceptions/exceptions';
import { InvalidateTokenByIdArgs } from '@modules/accounts/args/invalidate-token-by-id.args';
import { OAuthDiscordArgs } from '@modules/accounts/args/oauth-discord.args';
import type { Request } from 'express';

@UseFilters(GraphqlExceptionFilter, ThrottlerExceptionFilter)
@Resolver('Accounts')
export class AccountsResolver {
  constructor(
    @Inject('PUB_SUB') private readonly pubSub: PubSub,
    private readonly accountsService: AccountsService,
  ) {}

  // @Throttle(10, 20)
  @Mutation(() => Token)
  async signIn(@Args() args: SignInArgs): Promise<Token> {
    return this.accountsService.validateUserByEmailAndPassword(args);
  }

  // @Throttle(10, 86400)
  @Mutation(() => User)
  async signUp(@Args() args: SignUpArgs): Promise<User> {
    return this.accountsService.createUser(args);
  }

  @Mutation(() => Token)
  async OAuthDiscord(@Req() req: Request, @Args() args: OAuthDiscordArgs): Promise<Token> {
    return this.accountsService.getTokenByDiscordCode(args);
  }

  @Mutation(() => Token)
  async confirmEmail(@Args() args: ConfirmEmailArgs): Promise<Token> {
    return this.accountsService.confirmEmail(args);
  }

  // @Throttle(3, 86400)
  @Mutation(() => User)
  @UseGuards(GqlAuthGuard)
  async requestEmailConfirmation(@CurrentUser() user: User): Promise<User> {
    return this.accountsService.requestEmailConfirmation(user);
  }

  // @Throttle(3, 86400)
  @Mutation(() => Boolean)
  async requestPasswordReset(@Args() args: RequestPasswordResetArgs): Promise<boolean> {
    return this.accountsService.requestPasswordReset(args);
  }

  @Mutation(() => Token)
  async resetPassword(@Args() args: ResetPasswordArgs): Promise<Token> {
    return this.accountsService.resetPassword(args);
  }

  // @Throttle(1, 60)
  @Mutation(() => User)
  @UseGuards(GqlAuthGuard)
  async updateUsername(@Args() args: UpdateUsernameArgs, @CurrentUser() user: User): Promise<User> {
    return this.accountsService.updateUsername(args, user);
  }

  @Query(() => Boolean)
  isUsernameFree(@Args() args: IsUsernameFreeArgs): Promise<boolean> {
    return this.accountsService.isUsernameFree(args);
  }

  @Query(() => Token, { nullable: true })
  @UseGuards(GqlAuthGuard)
  getTokenByDiscordId(@Args() args: GetTokenByDiscordIdArgs, @CurrentUser() user: User): Promise<Token | null> {
    if (!user.roleNames.includes(AppRoles.ADMIN)) throw new BadRequestException('FORBIDDEN');
    return this.accountsService.getTokenByDiscordId(args);
  }

  @Mutation(() => Boolean)
  @UseGuards(GqlAuthGuard)
  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  invalidateCurrentToken(@Context() context: any): Promise<boolean> {
    const token = context?.req?.headers['authorization']?.replace('Bearer ', '') || '';
    return this.accountsService.invalidateTokenByValue(token);
  }

  @Mutation(() => Boolean)
  @UseGuards(GqlAuthGuard)
  invalidateTokenById(@Args() args: InvalidateTokenByIdArgs, @CurrentUser() user: User): Promise<boolean> {
    return this.accountsService.invalidateTokenById(args, user);
  }

  @Mutation(() => Boolean)
  @UseGuards(GqlAuthGuard)
  invalidateAllTokens(@CurrentUser() user: User): Promise<boolean> {
    return this.accountsService.invalidateAllTokens(user);
  }

  @Query(() => [Token])
  @UseGuards(GqlAuthGuard)
  getTokens(@CurrentUser() user: User): Promise<Token[]> {
    return this.accountsService.getTokens(user);
  }

  @Subscription(() => String)
  userRegisteredViaDiscord(): AsyncIterator<string> {
    return this.pubSub.asyncIterableIterator(SubscriptionEvents.USER_REGISTERED_VIA_DISCORD);
  }
}
