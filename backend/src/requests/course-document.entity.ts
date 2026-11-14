import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { CourseRequest } from './course-request.entity';

/** Support (PDF) ou replay déposé dans la salle de cours ; gardé jusqu'à l'examen. */
@Entity('document')
export class CourseDocument {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => CourseRequest, (r) => r.documents, { onDelete: 'CASCADE' })
  request!: CourseRequest;

  @Column({ type: 'varchar', length: 8 })
  kind!: 'pdf' | 'replay';

  @Column()
  name!: string;

  @Column()
  url!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
