import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { CommentEntity } from '../entities/comment.entity';
import { CommentsRepository } from './comments.repository';

@Injectable()
export class CommentsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly repo: CommentsRepository,
  ) {}

  async listTopLevelComments(params: {
    articleId: number;
    limit: number;
    order: 'asc' | 'desc';
    cursor?: { createdAt: string; id: number };
  }): Promise<{ items: CommentEntity[]; nextCursor?: { createdAt: string; id: number } }> {
    const limit = Math.min(Math.max(params.limit, 1), 100);

    const article = await this.repo.findArticleById(this.dataSource.manager, params.articleId);
    if (!article) {
      throw new NotFoundException('article not found');
    }

    const rows = await this.repo.listTopLevelComments(this.dataSource.manager, {
      articleId: params.articleId,
      limit: limit + 1,
      order: params.order,
      cursor: params.cursor,
    });

    const items = rows.slice(0, limit);
    const hasMore = rows.length > limit;
    const nextCursor = hasMore
      ? {
          createdAt: items[items.length - 1].createdAt,
          id: items[items.length - 1].id,
        }
      : undefined;

    return { items, nextCursor };
  }

  async softDeleteComment(commentId: number): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const comment = await this.repo.findCommentById(manager, commentId);
      if (!comment) {
        throw new NotFoundException('comment not found');
      }

      if (comment.isDeleted === 1) {
        return;
      }

      const nowIso = new Date().toISOString();
      await this.repo.softDeleteComment(manager, commentId, nowIso);
    });
  }

  async createTopLevelComment(params: {
    articleId: number;
    content: string;
    authorId?: number;
  }): Promise<CommentEntity> {
    const content = (params.content ?? '').trim();
    if (!content) {
      throw new BadRequestException('content is required');
    }

    return this.dataSource.transaction(async (manager) => {
      const article = await this.repo.findArticleById(manager, params.articleId);
      if (!article) {
        throw new NotFoundException('article not found');
      }

      const nowIso = new Date().toISOString();

      const comment = new CommentEntity();
      comment.articleId = params.articleId;
      comment.rootId = 0;
      comment.parentId = null;
      comment.depth = 0;
      comment.authorId = params.authorId ?? null;
      comment.content = content;
      comment.status = 1;
      comment.isDeleted = 0;
      comment.createdAt = nowIso;
      comment.updatedAt = nowIso;

      const saved = await this.repo.saveComment(manager, comment);
      await this.repo.updateCommentRootId(manager, saved.id, saved.id);
      saved.rootId = saved.id;

      await this.repo.incrementArticleCommentCount(manager, params.articleId, nowIso);

      return saved;
    });
  }
}
