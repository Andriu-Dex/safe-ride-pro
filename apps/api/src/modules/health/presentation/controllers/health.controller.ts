import { Controller, Get } from '@nestjs/common';

import { CheckHealthUseCase, type HealthCheckResult } from '../../application/use-cases/check-health.use-case';

@Controller('health')
export class HealthController {
  constructor(private readonly checkHealthUseCase: CheckHealthUseCase) {}

  @Get()
  async getHealth(): Promise<HealthCheckResult> {
    return this.checkHealthUseCase.execute();
  }
}
