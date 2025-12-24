import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';

import { ArticleEntity } from '../entities/article.entity';
import { CommentEntity } from '../entities/comment.entity';

@Injectable()
export class CommentsRepository {
  findArticleById(manager: EntityManager, articleId: number) {
    return manager.getRepository(ArticleEntity).findOne({ where: { id: articleId } });
  }

  findCommentById(manager: EntityManager, commentId: number) {
    return manager.getRepository(CommentEntity).findOne({ where: { id: commentId } });
  }

  listByRootId(
    manager: EntityManager,
    params: {
      articleId: number;
      rootId: number;
    },
  ) {
    return manager
      .getRepository(CommentEntity)
      .createQueryBuilder('c')
      .where('c.articleId = :articleId', { articleId: params.articleId })
      .andWhere('c.rootId = :rootId', { rootId: params.rootId })
      .orderBy('c.createdAt', 'ASC')
      .addOrderBy('c.id', 'ASC')
      .getMany();
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
      .andWhere('c.parentId IS NULL')
      .andWhere('c.isDeleted = 0');

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

  async listFirstNChildrenForParents(
    manager: EntityManager,
    params: {
      articleId: number;
      parentIds: number[];
      limitPerParent: number;
      order: 'asc' | 'desc';
    },
  ) {
    if (params.parentIds.length === 0 || params.limitPerParent <= 0) {
      return [] as CommentEntity[];
    }

    const placeholders = params.parentIds.map(() => '?').join(',');
    const direction = params.order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const sql = `
      SELECT
        id as id,
        article_id as articleId,
        root_id as rootId,
        parent_id as parentId,
        depth as depth,
        author_id as authorId,
        content as content,
        status as status,
        is_deleted as isDeleted,
        created_at as createdAt,
        updated_at as updatedAt
      FROM (
        SELECT
          c.*,
          ROW_NUMBER() OVER (
            PARTITION BY c.parent_id
            ORDER BY c.created_at ${direction}, c.id ${direction}
          ) AS rn
        FROM comments c
        WHERE c.article_id = ?
          AND c.parent_id IN (${placeholders})
          AND c.is_deleted = 0
      ) t
      WHERE t.rn <= ?
      ORDER BY t.parent_id ASC, t.created_at ${direction}, t.id ${direction}
    `;

    const rawRows = await manager.query(sql, [params.articleId, ...params.parentIds, params.limitPerParent]);
    return rawRows as CommentEntity[];
  }

  listChildren(
    manager: EntityManager,
    params: {
      articleId: number;
      parentId: number;
      limit: number;
      order: 'asc' | 'desc';
      cursor?: { createdAt: string; id: number };
    },
  ) {
    const qb = manager
      .getRepository(CommentEntity)
      .createQueryBuilder('c')
      .where('c.articleId = :articleId', { articleId: params.articleId })
      .andWhere('c.parentId = :parentId', { parentId: params.parentId })
      .andWhere('c.isDeleted = 0');

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

  softDeleteComment(manager: EntityManager, commentId: number, nowIso: string) {
    return manager
      .getRepository(CommentEntity)
      .update({ id: commentId }, { isDeleted: 1, updatedAt: nowIso });
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
