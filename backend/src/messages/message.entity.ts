import { Column, CreateDateColumn, Entity, Index, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { TutorProfile } from '../catalog/tutor-profile.entity';
import { User } from '../users/user.entity';

/** Un message d'une conversation étudiant ↔ tuteur (page « Messages » du sitemap). */
@Entity('message')
@Index(['student', 'tutor', 'createdAt'])
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  student!: User;

  @ManyToOne(() => TutorProfile, { onDelete: 'CASCADE' })
  tutor!: TutorProfile;

  @Column({ type: 'varchar', length: 10 })
  fromRole!: 'etudiant' | 'tuteur';

  /** Texte enregistré APRÈS masquage des coordonnées : le texte d'origine n'est jamais stocké. */
  @Column({ type: 'text' })
  body!: string;

  @Column({ default: false })
  masked!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  readAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
