import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('poll_votes')
export class PollVote {
  @PrimaryColumn({ name: 'message_id', type: 'int' })
  messageId: number;

  @PrimaryColumn({ name: 'user_id', type: 'int' })
  userId: number;

  @Column({ name: 'voted_at', type: 'timestamp with time zone', nullable: true, default: () => 'CURRENT_TIMESTAMP' })
  votedAt: Date | null;

  @PrimaryColumn({ name: 'option_id', type: 'int' })
  optionId: number;
}
