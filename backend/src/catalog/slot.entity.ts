import { Column, Entity, Index, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { TutorProfile } from './tutor-profile.entity';

/** Une heure libre proposée par le tuteur. Elle est bloquée dès qu'une demande est envoyée. */
@Entity('creneau')
@Index(['tutor', 'startsAt'], { unique: true })
export class Slot {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => TutorProfile, (t) => t.slots, { onDelete: 'CASCADE' })
  tutor!: TutorProfile;

  @Column({ type: 'timestamptz' })
  startsAt!: Date;

  @Column({ type: 'int', default: 60 })
  durationMin!: number;

  @Column({ default: false })
  booked!: boolean;
}
