import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('poll_options')
export class MessagePollOption {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'message_id', type: 'int' })
  messageId: number;

  @Column({ type: 'varchar', length: 100 })
  label: string;

  @Column({ type: 'int' })
  position: number;
}
