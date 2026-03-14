import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const globalPrefix = 'api/v1';
  app.setGlobalPrefix(globalPrefix);

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  );

  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:4200',
    'https://koya-nu.vercel.app',
    'https://koya.olesereni.site',
  ];

  // Allow additional origins from env (comma-separated)
  if (process.env.CORS_ORIGINS) {
    allowedOrigins.push(...process.env.CORS_ORIGINS.split(',').map(o => o.trim()));
  }

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  const port = process.env.API_PORT || process.env.PORT || 3333;
  await app.listen(port);
  Logger.log(
    `Koya API running on http://localhost:${port}/${globalPrefix}`,
  );
}

bootstrap();
