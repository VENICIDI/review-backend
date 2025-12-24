import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';

import { ArticleEntity } from '../entities/article.entity';
import { CommentEntity } from '../entities/comment.entity';

@Injectable()
export class CommentsRepository {
  findArticleById(manager: EntityManager, articleId: number) {
    return manager.getRepository(ArticleEntity).findOne({ where: { id: articleId } });
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
