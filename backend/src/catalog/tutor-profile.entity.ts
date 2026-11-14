import { Column, Entity, JoinColumn, OneToMany, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../users/user.entity';
import { Rate } from './rate.entity';
import { Slot } from './slot.entity';

export type TutorStatus = 'en_attente' | 'valide';

@Entity('profil_tuteur')
export class TutorProfile {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @OneToOne(() => User, (u) => u.tutorProfile, { onDelete: 'CASCADE' })
  @JoinColumn()
  user!: User;

  @Column({ type: 'text', default: '' })
  bio!: string;

  /** Moyenne déclarée, vérifiée par l'admin sur le relevé (le relevé est ensuite supprimé). */
  @Column({ type: 'real', nullable: true })
  declaredAverage!: number | null;

  @Column({ type: 'varchar', length: 12, default: 'en_attente' })
  status!: TutorStatus;

  @Column('simple-array', { default: 'fr' })
  languages!: string[];

  @Column({ type: 'int', default: 0 })
  minutesTaught!: number;

  @Column({ type: 'int', default: 0 })
  ratingSum!: number;

  @Column({ type: 'int', default: 0 })
  ratingCount!: number;

  /** Demandes reçues / demandes auxquelles il a répondu : sert au taux de réponse et au classement. */
  @Column({ type: 'int', default: 0 })
  requestsReceived!: number;

  @Column({ type: 'int', default: 0 })
  requestsAnswered!: number;

  @OneToMany(() => Rate, (r) => r.tutor)
  rates!: Rate[];

  @OneToMany(() => Slot, (s) => s.tutor)
  slots!: Slot[];
}
