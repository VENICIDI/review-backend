import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'articles' })
export class ArticleEntity {
  @PrimaryGeneratedColumn({ name: 'id', type: 'integer' })
  id!: number;

  @Column({ name: 'title', type: 'text', nullable: false })
  title!: string;

  @Column({ name: 'created_at', type: 'text', nullable: false })
  createdAt!: string;

  @Column({ name: 'updated_at', type: 'text', nullable: false })
  updatedAt!: string;

  @Column({ name: 'comment_count', type: 'integer', nullable: false, default: 0 })
  commentCount!: number;
}
