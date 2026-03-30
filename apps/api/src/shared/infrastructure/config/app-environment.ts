import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

export type AppEnvironment = {
  port: number;
  databaseUrl: string;
  jwtSecret: string;
  accessTokenTtlMinutes: number;
  refreshTokenTtlDays: number;
  emailVerificationTokenTtlMinutes: number;
  passwordResetTokenTtlMinutes: number;
  authResendCooldownSeconds: number;
  authFailedAttemptLimit: number;
  authFailedAttemptWindowMinutes: number;
  authAllowDebugCodes: boolean;
  resendApiKey: string | null;
  resendFromEmail: string | null;
  resendFromName: string;
  webAppOrigins: string[];
};

const ENV_PATH_CANDIDATES = [
  resolve(process.cwd(), 'apps/api/.env'),
  resolve(process.cwd(), '.env'),
];

let cachedEnvironment: AppEnvironment | null = null;
let environmentFileLoaded = false;

function loadEnvironmentFile(): void {
  if (environmentFileLoaded) {
    return;
  }

  environmentFileLoaded = true;

  if (typeof process.loadEnvFile !== 'function') {
    return;
  }

  const envPath = ENV_PATH_CANDIDATES.find((candidatePath) => existsSync(candidatePath));

  if (envPath) {
    process.loadEnvFile(envPath);
  }
}

function getRequiredString(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getOptionalString(name: string): string | null {
  const value = process.env[name]?.trim();

  return value ? value : null;
}

function getPositiveInteger(name: string, fallback: number): number {
  const rawValue = process.env[name]?.trim();

  if (!rawValue) {
    return fallback;
  }

  const parsedValue = Number.parseInt(rawValue, 10);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    throw new Error(`Environment variable ${name} must be a positive integer.`);
  }

  return parsedValue;
}

function getStringList(name: string, fallback: string[]): string[] {
  const rawValue = process.env[name]?.trim();

  if (!rawValue) {
    return fallback;
  }

  const values = rawValue
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  if (values.length === 0) {
    throw new Error(`Environment variable ${name} must contain at least one origin.`);
  }

  return values;
}

function getBoolean(name: string, fallback: boolean): boolean {
  const rawValue = process.env[name]?.trim().toLowerCase();

  if (!rawValue) {
    return fallback;
  }

  if (rawValue === 'true') {
    return true;
  }

  if (rawValue === 'false') {
    return false;
  }

  throw new Error(`Environment variable ${name} must be either true or false.`);
}

export function getAppEnvironment(): AppEnvironment {
  if (cachedEnvironment) {
    return cachedEnvironment;
  }

  loadEnvironmentFile();

  cachedEnvironment = {
    port: getPositiveInteger('PORT', 3001),
    databaseUrl: getRequiredString('DATABASE_URL'),
    jwtSecret: getRequiredString('JWT_SECRET'),
    accessTokenTtlMinutes: getPositiveInteger('ACCESS_TOKEN_TTL_MINUTES', 15),
    refreshTokenTtlDays: getPositiveInteger('REFRESH_TOKEN_TTL_DAYS', 14),
    emailVerificationTokenTtlMinutes: getPositiveInteger(
      'EMAIL_VERIFICATION_TOKEN_TTL_MINUTES',
      30,
    ),
    passwordResetTokenTtlMinutes: getPositiveInteger('PASSWORD_RESET_TOKEN_TTL_MINUTES', 30),
    authResendCooldownSeconds: getPositiveInteger('AUTH_RESEND_COOLDOWN_SECONDS', 60),
    authFailedAttemptLimit: getPositiveInteger('AUTH_FAILED_ATTEMPT_LIMIT', 5),
    authFailedAttemptWindowMinutes: getPositiveInteger(
      'AUTH_FAILED_ATTEMPT_WINDOW_MINUTES',
      10,
    ),
    authAllowDebugCodes: getBoolean(
      'AUTH_ALLOW_DEBUG_CODES',
      process.env.NODE_ENV !== 'production',
    ),
    resendApiKey: getOptionalString('RESEND_API_KEY'),
    resendFromEmail: getOptionalString('RESEND_FROM_EMAIL'),
    resendFromName: getOptionalString('RESEND_FROM_NAME') ?? 'SafeRidePro',
    webAppOrigins: getStringList('WEB_APP_ORIGINS', ['http://localhost:3000']),
  };

  return cachedEnvironment;
}
