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

  get accessTokenTtlMinutes(): number {
    return this.environment.accessTokenTtlMinutes;
  }

  get refreshTokenTtlDays(): number {
    return this.environment.refreshTokenTtlDays;
  }

  get emailVerificationTokenTtlMinutes(): number {
    return this.environment.emailVerificationTokenTtlMinutes;
  }

  get passwordResetTokenTtlMinutes(): number {
    return this.environment.passwordResetTokenTtlMinutes;
  }

  get authResendCooldownSeconds(): number {
    return this.environment.authResendCooldownSeconds;
  }

  get authFailedAttemptLimit(): number {
    return this.environment.authFailedAttemptLimit;
  }

  get authFailedAttemptWindowMinutes(): number {
    return this.environment.authFailedAttemptWindowMinutes;
  }

  get authAllowDebugCodes(): boolean {
    return this.environment.authAllowDebugCodes;
  }

  get resendApiKey(): string | null {
    return this.environment.resendApiKey;
  }

  get resendFromEmail(): string | null {
    return this.environment.resendFromEmail;
  }

  get resendFromName(): string {
    return this.environment.resendFromName;
  }

  get webAppOrigins(): string[] {
    return this.environment.webAppOrigins;
  }
}
