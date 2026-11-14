import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Matière générale, commune à toutes les écoles (« Probabilités », pas « Module MA-201 »). */
@Entity('matiere')
export class Subject {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  code!: string;

  @Column()
  nameFr!: string;

  @Column()
  nameAr!: string;

  @Column()
  nameEn!: string;
}
