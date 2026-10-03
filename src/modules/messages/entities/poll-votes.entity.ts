import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('poll_votes')
export class PollVote {
  @PrimaryColumn({ name: 'message_id', type: 'int' })
  messageId: number;

  @PrimaryColumn({ name: 'user_id', type: 'int' })
  userId: number;

  @Column({ name: 'option_index', type: 'int' })
  optionIndex: number;
}
