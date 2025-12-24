import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const start = process.hrtime.bigint();

    const http = context.switchToHttp();
    const req = http.getRequest<Request & { ip?: string; originalUrl?: string }>();
    const res = http.getResponse<{ statusCode?: number }>();

    const controller = context.getClass()?.name ?? 'UnknownController';
    const handler = context.getHandler()?.name ?? 'unknownHandler';

    const method = (req as any)?.method;
    const url = (req as any)?.originalUrl ?? (req as any)?.url;
    const ip = (req as any)?.ip;
    const userAgent = (req as any)?.headers?.['user-agent'];

    const logQuery = process.env.LOG_QUERY === '1';
    const logBody = process.env.LOG_BODY === '1';

    const query = logQuery ? (req as any)?.query : undefined;
    const body = logBody ? (req as any)?.body : undefined;

    return next.handle().pipe(
      finalize(() => {
        const end = process.hrtime.bigint();
        const costMs = Number(end - start) / 1_000_000;
        const statusCode = (res as any)?.statusCode;

        const extra: Record<string, unknown> = {};
        if (ip) extra.ip = ip;
        if (userAgent) extra.ua = userAgent;
        if (query !== undefined) extra.query = query;
        if (body !== undefined) extra.body = body;

        const extraText = Object.keys(extra).length ? ` ${JSON.stringify(extra)}` : '';

        this.logger.log(
          `${controller}#${handler} ${String(method)} ${String(url)} ${String(statusCode)} ${costMs.toFixed(1)}ms${extraText}`,
        );
      }),
    );
  }
}
