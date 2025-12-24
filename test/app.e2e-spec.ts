import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { DataSource } from 'typeorm';

import { ArticleEntity } from './../src/entities/article.entity';
import { CommentEntity } from './../src/entities/comment.entity';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;

  beforeEach(async () => {
    process.env.DB_PATH = ':memory:';
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dataSource = app.get(DataSource);
  });

  afterEach(async () => {
    await app.close();
    delete process.env.DB_PATH;
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  it('/articles/:articleId/comments (POST)', async () => {
    const nowIso = new Date().toISOString();
    const article = await dataSource.getRepository(ArticleEntity).save({
      title: 't1',
      createdAt: nowIso,
      updatedAt: nowIso,
      commentCount: 0,
    });

    const res = await request(app.getHttpServer())
      .post(`/articles/${article.id}/comments`)
      .send({ content: 'hello', authorId: 9 })
      .expect(201);

    expect(res.body).toHaveProperty('comment');
    expect(res.body.comment).toMatchObject({
      articleId: article.id,
      parentId: null,
      content: 'hello',
      authorId: 9,
      depth: 0,
    });
    expect(typeof res.body.comment.id).toBe('number');
    expect(res.body.comment.rootId).toBe(res.body.comment.id);
  });

  it('/articles/:articleId/comments (GET) pagination', async () => {
    const now = new Date();
    const article = await dataSource.getRepository(ArticleEntity).save({
      title: 't2',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      commentCount: 0,
    });

    const commentsRepo = dataSource.getRepository(CommentEntity);
    const c1 = await commentsRepo.save({
      articleId: article.id,
      rootId: 1,
      parentId: null,
      depth: 0,
      authorId: 1,
      content: 'c1',
      status: 1,
      isDeleted: 0,
      createdAt: new Date(now.getTime() + 1).toISOString(),
      updatedAt: new Date(now.getTime() + 1).toISOString(),
    });
    await commentsRepo.update({ id: c1.id }, { rootId: c1.id });

    const c2 = await commentsRepo.save({
      articleId: article.id,
      rootId: 1,
      parentId: null,
      depth: 0,
      authorId: 1,
      content: 'c2',
      status: 1,
      isDeleted: 0,
      createdAt: new Date(now.getTime() + 2).toISOString(),
      updatedAt: new Date(now.getTime() + 2).toISOString(),
    });
    await commentsRepo.update({ id: c2.id }, { rootId: c2.id });

    const c3 = await commentsRepo.save({
      articleId: article.id,
      rootId: 1,
      parentId: null,
      depth: 0,
      authorId: 1,
      content: 'c3',
      status: 1,
      isDeleted: 0,
      createdAt: new Date(now.getTime() + 3).toISOString(),
      updatedAt: new Date(now.getTime() + 3).toISOString(),
    });
    await commentsRepo.update({ id: c3.id }, { rootId: c3.id });

    const page1 = await request(app.getHttpServer())
      .get(`/articles/${article.id}/comments`)
      .query({ limit: 2, order: 'asc' })
      .expect(200);

    expect(page1.body.items).toHaveLength(2);
    expect(page1.body.items.map((x: any) => x.content)).toEqual(['c1', 'c2']);
    expect(typeof page1.body.nextCursor).toBe('string');

    const page2 = await request(app.getHttpServer())
      .get(`/articles/${article.id}/comments`)
      .query({ limit: 2, order: 'asc', cursor: page1.body.nextCursor })
      .expect(200);

    expect(page2.body.items).toHaveLength(1);
    expect(page2.body.items[0].content).toBe('c3');
    expect(page2.body.nextCursor).toBeUndefined();
  });

  it('/comments/:commentId (DELETE) soft delete', async () => {
    const nowIso = new Date().toISOString();
    const article = await dataSource.getRepository(ArticleEntity).save({
      title: 't3',
      createdAt: nowIso,
      updatedAt: nowIso,
      commentCount: 0,
    });

    const created = await request(app.getHttpServer())
      .post(`/articles/${article.id}/comments`)
      .send({ content: 'to-delete', authorId: 1 })
      .expect(201);

    const commentId = created.body.comment.id;

    await request(app.getHttpServer()).delete(`/comments/${commentId}`).expect(204);

    const list = await request(app.getHttpServer())
      .get(`/articles/${article.id}/comments`)
      .query({ limit: 20, order: 'asc' })
      .expect(200);

    expect(list.body.items).toHaveLength(0);
  });

  it('/comments/:commentId/replies (POST)', async () => {
    const nowIso = new Date().toISOString();
    const article = await dataSource.getRepository(ArticleEntity).save({
      title: 't4',
      createdAt: nowIso,
      updatedAt: nowIso,
      commentCount: 0,
    });

    const created = await request(app.getHttpServer())
      .post(`/articles/${article.id}/comments`)
      .send({ content: 'parent', authorId: 1 })
      .expect(201);

    const parentId = created.body.comment.id;

    const res = await request(app.getHttpServer())
      .post(`/comments/${parentId}/replies`)
      .send({ content: 'child', authorId: 9 })
      .expect(201);

    expect(res.body).toHaveProperty('comment');
    expect(res.body.comment).toMatchObject({
      articleId: article.id,
      parentId,
      rootId: parentId,
      depth: 1,
      content: 'child',
      authorId: 9,
    });
    expect(typeof res.body.comment.id).toBe('number');
  });

  it('/comments/:commentId/replies (POST) parent not found', async () => {
    await request(app.getHttpServer())
      .post(`/comments/999999/replies`)
      .send({ content: 'child', authorId: 9 })
      .expect(404);
  });

  it('/comments/:commentId/replies (POST) parent deleted not allowed', async () => {
    const nowIso = new Date().toISOString();
    const article = await dataSource.getRepository(ArticleEntity).save({
      title: 't5',
      createdAt: nowIso,
      updatedAt: nowIso,
      commentCount: 0,
    });

    const created = await request(app.getHttpServer())
      .post(`/articles/${article.id}/comments`)
      .send({ content: 'parent', authorId: 1 })
      .expect(201);

    const parentId = created.body.comment.id;

    await request(app.getHttpServer()).delete(`/comments/${parentId}`).expect(204);

    const res = await request(app.getHttpServer())
      .post(`/comments/${parentId}/replies`)
      .send({ content: 'child', authorId: 9 })
      .expect(400);

    expect(res.body?.message).toBe('cannot reply to deleted comment');
  });
});
