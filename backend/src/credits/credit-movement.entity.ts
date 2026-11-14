import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../users/user.entity';

export type CreditReason = 'recharge' | 'paiement' | 'remboursement';

/**
 * Le solde n'est pas un simple nombre : c'est la somme des mouvements.
 * Chaque paiement et chaque remboursement reste ainsi traçable.
 */
@Entity('mouvement_credit')
export class CreditMovement {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user!: User;

  /** Positif : crédit reçu. Négatif : crédit dépensé. */
  @Column({ type: 'int' })
  amountMillimes!: number;

  @Column({ type: 'varchar', length: 14 })
  reason!: CreditReason;

  @Column({ default: '' })
  label!: string;

  @Column({ type: 'uuid', nullable: true })
  requestId!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
