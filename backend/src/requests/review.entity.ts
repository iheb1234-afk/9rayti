import { Column, CreateDateColumn, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { CourseRequest } from './course-request.entity';

/** Un avis ne peut être laissé qu'après un cours réellement fait. */
@Entity('avis')
export class Review {
  @PrimaryGeneratedColumn()
  id!: number;

  @OneToOne(() => CourseRequest, (r) => r.review, { onDelete: 'CASCADE' })
  @JoinColumn()
  request!: CourseRequest;

  @Column({ type: 'int' })
  rating!: number;

  @Column({ type: 'text', default: '' })
  comment!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
