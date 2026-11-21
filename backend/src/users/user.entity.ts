import { Column, CreateDateColumn, Entity, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import type { Role } from '../common/roles';
import { TutorProfile } from '../catalog/tutor-profile.entity';

/** Un compte = un rôle. Un étudiant qui veut aussi enseigner crée un second compte. */
@Entity('compte')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  email!: string;

  @Column({ select: false })
  passwordHash!: string;

  @Column({ type: 'varchar', length: 10 })
  role!: Role;

  @Column()
  firstName!: string;

  @Column()
  lastName!: string;

  @Column({ default: '' })
  school!: string;

  @Column({ default: '' })
  year!: string;

  @Column({ type: 'varchar', length: 2, default: 'fr' })
  lang!: 'fr' | 'ar' | 'en';

  /** 0 = pas de photo. Incrémenté à chaque nouvelle photo : sert de clé de cache dans l'URL. */
  @Column({ type: 'int', default: 0 })
  avatarVersion!: number;

  @OneToOne(() => TutorProfile, (p) => p.user)
  tutorProfile?: TutorProfile;

  @CreateDateColumn()
  createdAt!: Date;
}
