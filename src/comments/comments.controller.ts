import { BadRequestException, Body, Controller, HttpCode, HttpStatus, Param, ParseIntPipe, Post } from '@nestjs/common';

import type { CreateCommentDto } from './dto/create-comment.dto';
import { CommentsService } from './comments.service';

@Controller()
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

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
        id: comment.id,
        articleId: comment.articleId,
        rootId: comment.rootId,
        parentId: comment.parentId,
        depth: comment.depth,
        authorId: comment.authorId,
        content: comment.content,
        status: comment.status,
        isDeleted: comment.isDeleted,
        createdAt: comment.createdAt,
        updatedAt: comment.updatedAt,
      },
    };
  }
}
