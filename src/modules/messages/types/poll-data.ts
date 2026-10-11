import type { PollVoter } from '../polls.types';
import type { MessagePoll } from '../entities/polls.entity';
import type { MessagePollOption } from '../entities/poll-options.entity';
import type { PollVote } from '../entities/poll-votes.entity';
import type { PollOptionCount } from './poll-option-count';

export interface PollData {
  poll: MessagePoll;
  options: MessagePollOption[];
  ownVotes: PollVote[];
  isClosed: boolean;
  totalVotes: number | null;
  counts: PollOptionCount[];
  voters: PollVoter[];
}
