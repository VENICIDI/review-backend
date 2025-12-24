import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';

import type { CreateCommentDto } from './dto/create-comment.dto';
import { CommentsService } from './comments.service';

@Controller()
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  private formatComment(comment: {
    id: number;
    articleId: number;
    rootId: number;
    parentId: number | null;
    depth: number;
    authorId: number | null;
    content: string;
    status: number;
    isDeleted: number;
    createdAt: string;
    updatedAt: string;
  }) {
    return {
      id: comment.id,
      articleId: comment.articleId,
      rootId: comment.rootId,
      parentId: comment.parentId,
      depth: comment.depth,
      authorId: comment.authorId,
      content: comment.isDeleted === 1 ? '该评论已删除' : comment.content,
      status: comment.status,
      isDeleted: comment.isDeleted,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
    };
  }

  private formatCommentTree(node: any): any {
    return {
      ...this.formatComment(node),
      children: Array.isArray(node.children) ? node.children.map((c: any) => this.formatCommentTree(c)) : [],
    };
  }

  @Get('/articles/:articleId/comments')
  async listTopLevelComments(
    @Param('articleId', ParseIntPipe) articleId: number,
    @Query('limit') limitRaw?: string,
    @Query('order') orderRaw?: string,
    @Query('cursor') cursorRaw?: string,
  ) {
    const limit = limitRaw === undefined ? 20 : Number(limitRaw);
    if (!Number.isFinite(limit)) {
      throw new BadRequestException('limit must be a number');
    }

    const order = (orderRaw ?? 'desc').toLowerCase();
    if (order !== 'asc' && order !== 'desc') {
      throw new BadRequestException('order must be asc or desc');
    }

    let cursor: { createdAt: string; id: number } | undefined;
    if (cursorRaw) {
      try {
        const json = Buffer.from(cursorRaw, 'base64url').toString('utf8');
        const parsed = JSON.parse(json);
        if (!parsed || typeof parsed.createdAt !== 'string' || typeof parsed.id !== 'number') {
          throw new Error('invalid cursor');
        }
        cursor = { createdAt: parsed.createdAt, id: parsed.id };
      } catch {
        throw new BadRequestException('cursor is invalid');
      }
    }

    const res = await this.commentsService.listTopLevelComments({
      articleId,
      limit,
      order,
      cursor,
    });

    const nextCursor = res.nextCursor
      ? Buffer.from(JSON.stringify(res.nextCursor), 'utf8').toString('base64url')
      : undefined;

    return {
      items: res.items.map((comment) => this.formatComment(comment)),
      nextCursor,
    };
  }

  @Get('/comments/:commentId/tree')
  async getCommentTree(@Param('commentId', ParseIntPipe) commentId: number) {
    const tree = await this.commentsService.getCommentTree(commentId);
    return {
      comment: this.formatCommentTree(tree),
    };
  }

  @Get('/comments/:commentId/children')
  async listChildren(
    @Param('commentId', ParseIntPipe) commentId: number,
    @Query('limit') limitRaw?: string,
    @Query('order') orderRaw?: string,
    @Query('cursor') cursorRaw?: string,
  ) {
    const limit = limitRaw === undefined ? 20 : Number(limitRaw);
    if (!Number.isFinite(limit)) {
      throw new BadRequestException('limit must be a number');
    }

    const order = (orderRaw ?? 'desc').toLowerCase();
    if (order !== 'asc' && order !== 'desc') {
      throw new BadRequestException('order must be asc or desc');
    }

    let cursor: { createdAt: string; id: number } | undefined;
    if (cursorRaw) {
      try {
        const json = Buffer.from(cursorRaw, 'base64url').toString('utf8');
        const parsed = JSON.parse(json);
        if (!parsed || typeof parsed.createdAt !== 'string' || typeof parsed.id !== 'number') {
          throw new Error('invalid cursor');
        }
        cursor = { createdAt: parsed.createdAt, id: parsed.id };
      } catch {
        throw new BadRequestException('cursor is invalid');
      }
    }

    const res = await this.commentsService.listChildren({
      commentId,
      limit,
      order,
      cursor,
    });

    const nextCursor = res.nextCursor
      ? Buffer.from(JSON.stringify(res.nextCursor), 'utf8').toString('base64url')
      : undefined;

    return {
      items: res.items.map((comment) => this.formatComment(comment)),
      nextCursor,
    };
  }

  @Post('/articles/:articleId/comments')
  @HttpCode(HttpStatus.CREATED)
  async createTopLevelComment(
    @Param('articleId', ParseIntPipe) articleId: number,
    @Body() body: CreateCommentDto,
  ) {
    if (body?.authorId !== undefined && typeof body.authorId !== 'number') {
      throw new BadRequestException('authorId must be a number');
    }

    const comment = await this.commentsService.createTopLevelComment({
      articleId,
      content: body?.content,
      authorId: body?.authorId,
    });

    return {
      comment: {
        ...this.formatComment(comment),
      },
    };
  }

  @Post('/comments/:commentId/replies')
  @HttpCode(HttpStatus.CREATED)
  async createReply(
    @Param('commentId', ParseIntPipe) commentId: number,
    @Body() body: CreateCommentDto,
  ) {
    if (body?.authorId !== undefined && typeof body.authorId !== 'number') {
      throw new BadRequestException('authorId must be a number');
    }

    const comment = await this.commentsService.createReply({
      commentId,
      content: body?.content,
      authorId: body?.authorId,
    });

    return {
      comment: {
        ...this.formatComment(comment),
      },
    };
  }

  @Delete('/comments/:commentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async softDeleteComment(@Param('commentId', ParseIntPipe) commentId: number) {
    await this.commentsService.softDeleteComment(commentId);
  }
}
