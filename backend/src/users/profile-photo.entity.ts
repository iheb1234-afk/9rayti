import { Column, Entity, JoinColumn, OneToOne, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { User } from './user.entity';

/**
 * Photo de profil, stockée à part pour ne pas alourdir chaque lecture du compte.
 * Redimensionnée dans le navigateur avant l'envoi (256 × 256, WebP) : quelques dizaines de ko.
 */
@Entity('photo_profil')
export class ProfilePhoto {
  @PrimaryColumn('uuid')
  userId!: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ type: 'varchar', length: 20 })
  mime!: string;

  @Column({ type: 'bytea' })
  data!: Buffer;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
