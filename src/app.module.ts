import { Injectable, Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { AppController } from './app.controller';
import { AppService } from './app.service';
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
  ],
  controllers: [AppController],
  providers: [AppService, SqliteForeignKeysService],
})
export class AppModule {}
