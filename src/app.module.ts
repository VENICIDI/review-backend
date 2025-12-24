import { Injectable, Module, OnModuleInit } from '@nestjs/common';
import type { NestModule } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { CommentsModule } from './comments/comments.module';
import { ArticleEntity } from './entities/article.entity';
import { CommentEntity } from './entities/comment.entity';

@Injectable()
class SqliteForeignKeysService implements OnModuleInit {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async onModuleInit() {
    await this.dataSource.query('PRAGMA foreign_keys = ON;');
  }
}

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: process.env.DB_PATH ?? 'db.sqlite',
      entities: [ArticleEntity, CommentEntity],
      synchronize: true,
    }),
    CommentsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    SqliteForeignKeysService,
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure() {}
}
