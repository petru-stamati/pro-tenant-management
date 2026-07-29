import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';

/** Normalizes every error response into the envelope defined in Phase 3 §1. */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();

    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const body = exception instanceof HttpException ? exception.getResponse() : null;

    if (body && typeof body === 'object' && 'code' in body) {
      res.status(status).json({ error: body });
      return;
    }

    const message =
      body && typeof body === 'object' && 'message' in body
        ? (body as { message: string | string[] }).message
        : exception instanceof Error
          ? exception.message
          : 'Internal server error';

    res.status(status).json({
      error: {
        code: HttpStatus[status] ?? 'INTERNAL_SERVER_ERROR',
        message,
      },
    });
  }
}
