import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { randomUUID } from 'crypto';
import { AppModule } from './app/app.module';
import type { Request, Response, NextFunction } from 'express';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false, // We configure body parsing manually below
  });

  // ── Trust proxy (ALB → ECS) ──────────────────────────────────
  const trustProxyHops = parseInt(process.env.TRUST_PROXY_HOPS || '1', 10);
  app.set('trust proxy', trustProxyHops);

  // ── Helmet security headers ──────────────────────────────────
  app.use(helmet());

  // ── Body parsing with size limits ────────────────────────────
  const jsonLimit = process.env.JSON_BODY_LIMIT || '100kb';
  const urlencodedLimit = process.env.URLENCODED_BODY_LIMIT || '100kb';

  // Use express json/urlencoded with limits
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const express = require('express');
  app.use(
    express.json({
      limit: jsonLimit,
      verify: (req: Request & { rawBody?: Buffer }, _res: Response, buf: Buffer) => {
        req.rawBody = Buffer.from(buf);
      },
    }),
  );
  app.use(
    express.urlencoded({
      extended: true,
      limit: urlencodedLimit,
      verify: (req: Request & { rawBody?: Buffer }, _res: Response, buf: Buffer) => {
        req.rawBody = Buffer.from(buf);
      },
    }),
  );

  // ── Request correlation ID ───────────────────────────────────
  app.use((req: Request, res: Response, next: NextFunction) => {
    const correlationId =
      (req.headers['x-request-id'] as string) || randomUUID();
    req.headers['x-request-id'] = correlationId;
    res.setHeader('x-request-id', correlationId);
    next();
  });

  // ── Global prefix & pipes ───────────────────────────────────
  const globalPrefix = 'api/v1';
  app.setGlobalPrefix(globalPrefix);

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  );

  // ── CORS ────────────────────────────────────────────────────
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:4200',
    'https://koyabank.com',
    'https://www.koyabank.com',
    'https://api.koyabank.com',
  ];

  if (process.env.CORS_ORIGINS) {
    allowedOrigins.push(
      ...process.env.CORS_ORIGINS.split(',').map((o) => o.trim()),
    );
  }

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  // ── Graceful shutdown hooks ─────────────────────────────────
  app.enableShutdownHooks();

  // ── Start listening ─────────────────────────────────────────
  const port = process.env.API_PORT || process.env.PORT || 3333;
  await app.listen(port);
  Logger.log(
    `Koya API running on http://localhost:${port}/${globalPrefix}`,
  );
}

bootstrap();
