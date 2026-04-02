import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';

import { AppModule } from '../../../src/app.module';
import { PrismaService } from '../../../src/shared/infrastructure/database/prisma.service';

export async function createRealDbTestApp(): Promise<{
  app: INestApplication;
  moduleRef: TestingModule;
  prisma: PrismaService;
}> {
  process.env.AUTH_ALLOW_DEBUG_CODES = 'true';
  process.env.SMTP_HOST = '';
  process.env.SMTP_USER = '';
  process.env.SMTP_PASSWORD = '';
  process.env.SMTP_PASS = '';
  process.env.SMTP_FROM_EMAIL = '';
  process.env.SMTP_FROM_NAME = '';

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication({
    logger: false,
  });

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  await app.init();

  return {
    app,
    moduleRef,
    prisma: moduleRef.get(PrismaService),
  };
}
