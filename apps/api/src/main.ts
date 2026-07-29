import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('v1');
  app.use(cookieParser());
  // CORS_ORIGIN: comma-separated allowed origins in production (e.g. the
  // Vercel frontend URL). Falls back to reflecting any origin for local dev,
  // where frontend/backend both run on http://localhost.
  const corsOrigin = process.env.CORS_ORIGIN?.split(',').map((o) => o.trim());
  app.enableCors({ origin: corsOrigin ?? true, credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`PRO Tenant API listening on http://localhost:${port}/v1`);
}

bootstrap();
