import { Injectable } from '@nestjs/common';

import { AppEnvironment, getAppEnvironment } from './app-environment';

@Injectable()
export class EnvironmentService {
  private readonly environment: AppEnvironment = getAppEnvironment();

  get port(): number {
    return this.environment.port;
  }

  get databaseUrl(): string {
    return this.environment.databaseUrl;
  }

  get jwtSecret(): string {
    return this.environment.jwtSecret;
  }

  get emailVerificationTokenTtlMinutes(): number {
    return this.environment.emailVerificationTokenTtlMinutes;
  }

  get webAppOrigins(): string[] {
    return this.environment.webAppOrigins;
  }
}
