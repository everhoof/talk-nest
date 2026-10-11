import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { User } from '@modules/users/entities/users.entity';

@Entity('poll_votes')
export class PollVote {
  @PrimaryColumn({ name: 'message_id', type: 'int' })
  messageId: number;

  @PrimaryColumn({ name: 'user_id', type: 'int' })
  userId: number;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id', referencedColumnName: 'id' })
  user: User;

  @Column({ name: 'voted_at', type: 'timestamp with time zone', nullable: true, default: () => 'CURRENT_TIMESTAMP' })
  votedAt: Date | null;

  @PrimaryColumn({ name: 'option_id', type: 'int' })
  optionId: number;
}
