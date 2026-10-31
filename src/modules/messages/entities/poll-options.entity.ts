import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('poll_options')
export class MessagePollOption {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'message_id', type: 'int' })
  messageId: number;

  @Column({ type: 'text' })
  label: string;

  @Column({ type: 'int' })
  position: number;
}
