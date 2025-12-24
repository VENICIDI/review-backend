import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';

import { ArticleEntity } from './article.entity';

@Index('idx_comments_article_created', ['articleId', 'createdAt'])
@Index('idx_comments_root_created', ['rootId', 'createdAt'])
@Index('idx_comments_root_depth_created', ['rootId', 'depth', 'createdAt'])
@Index('idx_comments_article_parent_created', ['articleId', 'parentId', 'createdAt'])
@Index('idx_comments_parent', ['parentId'])
@Entity({ name: 'comments' })
export class CommentEntity {
  @PrimaryGeneratedColumn({ name: 'id', type: 'integer' })
  id!: number;

  @Column({ name: 'article_id', type: 'integer', nullable: false })
  articleId!: number;

  @ManyToOne(() => ArticleEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'article_id' })
  article!: ArticleEntity;

  @Column({ name: 'root_id', type: 'integer', nullable: false })
  rootId!: number;

  @Column({ name: 'parent_id', type: 'integer', nullable: true })
  parentId!: number | null;

  @ManyToOne(() => CommentEntity, (c) => c.children, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'parent_id' })
  parent!: CommentEntity | null;

  @OneToMany(() => CommentEntity, (c) => c.parent)
  children!: CommentEntity[];

  @Column({ name: 'depth', type: 'integer', nullable: false })
  depth!: number;

  @Column({ name: 'author_id', type: 'integer', nullable: true })
  authorId!: number | null;

  @Column({ name: 'content', type: 'text', nullable: false })
  content!: string;

  @Column({ name: 'status', type: 'integer', nullable: false, default: 1 })
  status!: number;

  @Column({ name: 'is_deleted', type: 'integer', nullable: false, default: 0 })
  isDeleted!: number;

  @Column({ name: 'created_at', type: 'text', nullable: false })
  createdAt!: string;

  @Column({ name: 'updated_at', type: 'text', nullable: false })
  updatedAt!: string;
}
