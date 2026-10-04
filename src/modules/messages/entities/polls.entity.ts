import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('polls')
export class MessagePoll {
  @PrimaryColumn({ name: 'message_id', type: 'int' })
  messageId: number;

  @Column({ type: 'varchar', length: 300 })
  question: string;

  @Column({ name: 'allow_multiple', type: 'boolean', default: false })
  allowMultiple: boolean;

  @Column({ name: 'allow_change_vote', type: 'boolean', default: false })
  allowChangeVote: boolean;

  @Column({ name: 'ends_at', type: 'timestamp with time zone', nullable: true })
  endsAt: Date | null;

  @Column({ name: 'closed_at', type: 'timestamp with time zone', nullable: true })
  closedAt: Date | null;

  get isClosed(): boolean {
    if (this.closedAt) {
      return true;
    }

    return !!this.endsAt && this.endsAt.getTime() <= Date.now();
  }
}
