import { Column, CreateDateColumn, Entity, Index, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../users/user.entity';

/**
 * Types de notifications. Le texte n'est pas stocké : le site le construit dans la langue
 * de l'utilisateur à partir du type et des paramètres (prénom, matière…).
 */
export type NotificationType =
  | 'demande_recue'
  | 'demande_acceptee'
  | 'demande_refusee'
  | 'demande_expiree'
  | 'cours_annule'
  | 'cours_termine'
  | 'avis_recu'
  | 'versement'
  | 'signalement'
  | 'signalement_traite'
  | 'message'
  | 'session_reservee'
  | 'session_annulee'
  | 'tuteur_valide'
  | 'contact';

@Entity('notification')
@Index(['user', 'createdAt'])
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user!: User;

  @Column({ type: 'varchar', length: 30 })
  type!: NotificationType;

  @Column({ type: 'jsonb', default: {} })
  params!: Record<string, string | number>;

  /** Lien interne vers la page concernée (« /mon-espace », « /messages/… »). */
  @Column({ type: 'varchar', length: 200, nullable: true })
  link!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  readAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
