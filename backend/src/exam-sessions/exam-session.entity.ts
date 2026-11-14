import { Column, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { Subject } from '../catalog/subject.entity';
import { TutorProfile } from '../catalog/tutor-profile.entity';
import { User } from '../users/user.entity';

/** Révision en groupe avant un examen : payée à la place, confirmée à partir d'un minimum d'inscrits. */
@Entity('session_examen')
export class ExamSession {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => TutorProfile, { eager: true, onDelete: 'CASCADE' })
  tutor!: TutorProfile;

  @ManyToOne(() => Subject, { eager: true })
  subject!: Subject;

  @Column({ type: 'timestamptz' })
  startsAt!: Date;

  @Column({ type: 'int' })
  durationMin!: number;

  @Column({ type: 'int' })
  placesMin!: number;

  @Column({ type: 'int' })
  placesMax!: number;

  @Column({ type: 'int' })
  pricePerPlaceMillimes!: number;

  @OneToMany(() => ExamPlace, (p) => p.session)
  places!: ExamPlace[];
}

@Entity('place')
@Unique(['session', 'student'])
export class ExamPlace {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => ExamSession, (s) => s.places, { onDelete: 'CASCADE' })
  session!: ExamSession;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  student!: User;
}
