import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';

import { ArticleEntity } from '../entities/article.entity';
import { CommentEntity } from '../entities/comment.entity';

@Injectable()
export class CommentsRepository {
  findArticleById(manager: EntityManager, articleId: number) {
    return manager.getRepository(ArticleEntity).findOne({ where: { id: articleId } });
  }

  listTopLevelComments(
    manager: EntityManager,
    params: {
      articleId: number;
      limit: number;
      order: 'asc' | 'desc';
      cursor?: { createdAt: string; id: number };
    },
  ) {
    const qb = manager
      .getRepository(CommentEntity)
      .createQueryBuilder('c')
      .where('c.articleId = :articleId', { articleId: params.articleId })
      .andWhere('c.parentId IS NULL');

    if (params.cursor) {
      if (params.order === 'desc') {
        qb.andWhere(
          '(c.createdAt < :cursorCreatedAt OR (c.createdAt = :cursorCreatedAt AND c.id < :cursorId))',
          {
            cursorCreatedAt: params.cursor.createdAt,
            cursorId: params.cursor.id,
          },
        );
      } else {
        qb.andWhere(
          '(c.createdAt > :cursorCreatedAt OR (c.createdAt = :cursorCreatedAt AND c.id > :cursorId))',
          {
            cursorCreatedAt: params.cursor.createdAt,
            cursorId: params.cursor.id,
          },
        );
      }
    }

    const direction = params.order.toUpperCase() as 'ASC' | 'DESC';
    qb.orderBy('c.createdAt', direction).addOrderBy('c.id', direction).take(params.limit);

    return qb.getMany();
  }

  saveComment(manager: EntityManager, comment: CommentEntity) {
    return manager.getRepository(CommentEntity).save(comment);
  }

  updateCommentRootId(manager: EntityManager, commentId: number, rootId: number) {
    return manager.getRepository(CommentEntity).update({ id: commentId }, { rootId });
  }

  async incrementArticleCommentCount(manager: EntityManager, articleId: number, nowIso: string) {
    const articlesRepo = manager.getRepository(ArticleEntity);
    await articlesRepo.increment({ id: articleId }, 'commentCount', 1);
    await articlesRepo.update({ id: articleId }, { updatedAt: nowIso });
  }
}
