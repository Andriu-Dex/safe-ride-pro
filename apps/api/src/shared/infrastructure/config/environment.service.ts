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

  get smtpHost(): string | null {
    return this.environment.smtpHost;
  }

  get smtpPort(): number {
    return this.environment.smtpPort;
  }

  get smtpSecure(): boolean {
    return this.environment.smtpSecure;
  }

  get smtpUser(): string | null {
    return this.environment.smtpUser;
  }

  get smtpPassword(): string | null {
    return this.environment.smtpPassword;
  }

  get smtpFromEmail(): string | null {
    return this.environment.smtpFromEmail;
  }

  get smtpFromName(): string {
    return this.environment.smtpFromName;
  }

  get webAppOrigins(): string[] {
    return this.environment.webAppOrigins;
  }
}
