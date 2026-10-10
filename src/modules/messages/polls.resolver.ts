import { Args, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { UseFilters, UseGuards } from '@nestjs/common';
import { GraphqlExceptionFilter } from '@modules/common/filters/http-exception.filter';
import { CurrentUser, GqlAuthGuard, OptionalGqlAuthGuard } from '@modules/common/guards/auth.guard';
import { User } from '@modules/users/entities/users.entity';
import { Message, MessageType } from './entities/messages.entity';
import { CreatePollArgs, GetPollArgs, Poll, UpdatePollArgs, VotePollArgs } from './polls.types';
import { PollsService } from './polls.service';

@UseFilters(GraphqlExceptionFilter)
@Resolver(() => Message)
export class PollsResolver {
  constructor(private readonly polls: PollsService) {}

  @ResolveField(() => Poll, { nullable: true })
  async poll(@Parent() message: Message, @CurrentUser() user?: User): Promise<Poll | null> {
    if (message.type !== MessageType.POLL || message.deletedAt) {
      return null;
    }

    return this.polls.getPoll(message.id, user);
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => Message)
  createPoll(@Args() args: CreatePollArgs, @CurrentUser() user: User): Promise<Message> {
    return this.polls.createPoll(args, user);
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => Message)
  updatePoll(@Args() args: UpdatePollArgs, @CurrentUser() user: User): Promise<Message> {
    return this.polls.updatePoll(args, user);
  }

  @UseGuards(OptionalGqlAuthGuard)
  @Query(() => Poll)
  getPoll(@Args() args: GetPollArgs, @CurrentUser() user?: User): Promise<Poll> {
    return this.polls.getPoll(args.messageId, user);
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => Poll)
  votePoll(@Args() args: VotePollArgs, @CurrentUser() user: User): Promise<Poll> {
    return this.polls.votePoll(args, user);
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => Poll)
  cancelPollVote(@Args() args: GetPollArgs, @CurrentUser() user: User): Promise<Poll> {
    return this.polls.cancelPollVote(args.messageId, user);
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => Poll)
  closePoll(@Args() args: GetPollArgs, @CurrentUser() user: User): Promise<Poll> {
    return this.polls.closePoll(args.messageId, user);
  }
}
