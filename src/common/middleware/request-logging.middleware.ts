import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RequestLoggingMiddleware.name);

  use(req: Request, res: Response, next: NextFunction) {
    const start = process.hrtime.bigint();

    res.on('finish', () => {
      const end = process.hrtime.bigint();
      const costMs = Number(end - start) / 1_000_000;

      const method = req.method;
      const url = req.originalUrl ?? req.url;
      const statusCode = res.statusCode;
      const contentLength = res.getHeader('content-length');

      this.logger.log(
        `${method} ${url} ${statusCode} ${costMs.toFixed(1)}ms${
          contentLength ? ` - ${String(contentLength)}b` : ''
        }`,
      );
    });

    next();
  }
}
