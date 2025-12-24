import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { DataSource } from 'typeorm';

import { ArticleEntity } from './../src/entities/article.entity';

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
});
