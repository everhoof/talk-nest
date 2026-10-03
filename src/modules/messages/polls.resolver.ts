import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseFilters, UseGuards } from '@nestjs/common';
import { GraphqlExceptionFilter } from '@modules/common/filters/http-exception.filter';
import { CurrentUser, GqlAuthGuard, OptionalGqlAuthGuard } from '@modules/common/guards/auth.guard';
import { User } from '@modules/users/entities/users.entity';
import { Message } from './entities/messages.entity';
import { CreatePollArgs, GetPollArgs, Poll, VotePollArgs } from './polls.types';
import { PollsService } from './polls.service';

@UseFilters(GraphqlExceptionFilter)
@Resolver()
export class PollsResolver {
  constructor(private readonly polls: PollsService) {}

  @UseGuards(GqlAuthGuard)
  @Mutation(() => Message)
  createPoll(@Args() args: CreatePollArgs, @CurrentUser() user: User): Promise<Message> {
    return this.polls.createPoll(args, user);
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
}
