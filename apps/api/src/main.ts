import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { getAppEnvironment } from './shared/infrastructure/config/app-environment';

async function bootstrap(): Promise<void> {
  const environment = getAppEnvironment();
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  await app.listen(environment.port);
}

void bootstrap();
