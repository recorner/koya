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

  app.enableCors({
    origin: [
      'http://localhost:3000',
      'http://localhost:4200',
    ],
    credentials: true,
  });

  const port = process.env.PORT || 3333;
  await app.listen(port);
  Logger.log(
    `Koya API running on http://localhost:${port}/${globalPrefix}`,
  );
}

bootstrap();
