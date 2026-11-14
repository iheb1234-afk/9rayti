import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Slot } from '../catalog/slot.entity';
import { Subject } from '../catalog/subject.entity';
import { TutorProfile } from '../catalog/tutor-profile.entity';
import { User } from '../users/user.entity';
import type { RequestState } from './request-state';
import { CourseDocument } from './course-document.entity';
import { Review } from './review.entity';

/**
 * Une demande de cours. Une fois acceptée, elle porte aussi la séance
 * (salle Jitsi, fin réelle) et l'éventuel signalement.
 */
@Entity('demande')
export class CourseRequest {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => User, { eager: true, onDelete: 'CASCADE' })
  student!: User;

  @ManyToOne(() => TutorProfile, { eager: true, onDelete: 'CASCADE' })
  tutor!: TutorProfile;

  @ManyToOne(() => Subject, { eager: true })
  subject!: Subject;

  @ManyToOne(() => Slot, { eager: true, onDelete: 'SET NULL', nullable: true })
  @JoinColumn()
  slot!: Slot | null;

  @Column({ type: 'timestamptz' })
  startsAt!: Date;

  @Column({ type: 'int' })
  durationMin!: number;

  @Column({ type: 'varchar', length: 16, default: 'en_attente' })
  state!: RequestState;

  @Column({ type: 'int' })
  amountMillimes!: number;

  @Column({ type: 'int' })
  feeMillimes!: number;

  @Column({ type: 'varchar', length: 8 })
  payWith!: 'credits' | 'carte';

  @Column({ type: 'varchar', nullable: true })
  attachmentName!: string | null;

  @Column({ type: 'text', default: '' })
  message!: string;

  @Column({ type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  answeredAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  doneAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  payoutAt!: Date | null;

  @Column({ type: 'text', nullable: true })
  reportReason!: string | null;

  @Column()
  jitsiRoom!: string;

  @OneToMany(() => CourseDocument, (d) => d.request)
  documents!: CourseDocument[];

  @OneToOne(() => Review, (r) => r.request)
  review?: Review;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
