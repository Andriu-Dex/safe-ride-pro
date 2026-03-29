import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';

type HealthStatus = 'ok';

export interface HealthCheckResult {
  status: HealthStatus;
  service: 'api';
  database: {
    status: HealthStatus;
  };
  timestamp: string;
  uptimeSeconds: number;
}

@Injectable()
export class CheckHealthUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(): Promise<HealthCheckResult> {
    await this.prisma.$queryRawUnsafe('SELECT 1');

    return {
      status: 'ok',
      service: 'api',
      database: {
        status: 'ok',
      },
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
    };
  }
}
