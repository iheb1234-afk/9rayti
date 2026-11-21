import { CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { TutorProfile } from '../catalog/tutor-profile.entity';
import { User } from '../users/user.entity';

/** Un tuteur mis de côté par un étudiant (idée reprise d'UPchieve et de LetTutor). */
@Entity('favori')
@Unique(['student', 'tutor'])
export class Favorite {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  student!: User;

  @ManyToOne(() => TutorProfile, { onDelete: 'CASCADE' })
  tutor!: TutorProfile;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
