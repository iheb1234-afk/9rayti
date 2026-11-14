import { Column, Entity, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { Subject } from './subject.entity';
import { TutorProfile } from './tutor-profile.entity';

/** Le tuteur fixe un prix par matière. */
@Entity('tarif')
@Unique(['tutor', 'subject'])
export class Rate {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => TutorProfile, (t) => t.rates, { onDelete: 'CASCADE' })
  tutor!: TutorProfile;

  @ManyToOne(() => Subject, { eager: true })
  subject!: Subject;

  @Column({ type: 'int' })
  pricePerHourMillimes!: number;
}
