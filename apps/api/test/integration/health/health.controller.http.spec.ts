import { INestApplication } from '@nestjs/common';
import request from 'supertest';

import {
  CheckHealthUseCase,
  HealthCheckResult,
} from '../../../src/modules/health/application/use-cases/check-health.use-case';
import { HealthController } from '../../../src/modules/health/presentation/controllers/health.controller';
import { createHttpTestApp } from '../../helpers/create-test-app';

describe('HealthController HTTP', () => {
  let app: INestApplication;
  const checkHealthUseCase = {
    execute: jest.fn<Promise<HealthCheckResult>, []>(),
  };

  beforeAll(async () => {
    const testApp = await createHttpTestApp({
      controllers: [HealthController],
      providers: [
        { provide: CheckHealthUseCase, useValue: checkHealthUseCase },
      ],
    });

    app = testApp.app;
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the application health payload', async () => {
    checkHealthUseCase.execute.mockResolvedValue({
      status: 'ok',
      service: 'api',
      database: {
        status: 'ok',
      },
      uptimeSeconds: 120,
      timestamp: new Date('2026-06-05T12:00:00.000Z').toISOString(),
    });

    const response = await request(app.getHttpServer())
      .get('/api/health')
      .expect(200);

    expect(response.body).toEqual({
      status: 'ok',
      service: 'api',
      database: {
        status: 'ok',
      },
      uptimeSeconds: 120,
      timestamp: '2026-06-05T12:00:00.000Z',
    });
    expect(checkHealthUseCase.execute).toHaveBeenCalled();
  });
});
