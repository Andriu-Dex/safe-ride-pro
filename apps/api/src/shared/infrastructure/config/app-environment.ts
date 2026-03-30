import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

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
  smtpHost: string | null;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string | null;
  smtpPassword: string | null;
  smtpFromEmail: string | null;
  smtpFromName: string;
  webAppOrigins: string[];
};

let cachedEnvironment: AppEnvironment | null = null;
let environmentFileLoaded = false;

function findWorkspaceRoot(startDirectory: string): string {
  let currentDirectory = startDirectory;

  while (true) {
    if (existsSync(resolve(currentDirectory, 'pnpm-workspace.yaml'))) {
      return currentDirectory;
    }

    const parentDirectory = dirname(currentDirectory);

    if (parentDirectory === currentDirectory) {
      return startDirectory;
    }

    currentDirectory = parentDirectory;
  }
}

function loadEnvironmentFile(): void {
  if (environmentFileLoaded) {
    return;
  }

  environmentFileLoaded = true;

  const workspaceRoot = findWorkspaceRoot(process.cwd());
  const envPathCandidates = [
    resolve(workspaceRoot, '.env'),
    resolve(workspaceRoot, 'apps/api/.env'),
  ];

  for (const envPath of envPathCandidates) {
    if (!existsSync(envPath)) {
      continue;
    }

    const rawFile = readFileSync(envPath, 'utf8');

    for (const rawLine of rawFile.split(/\r?\n/)) {
      const line = rawLine.trim();

      if (!line || line.startsWith('#')) {
        continue;
      }

      const separatorIndex = line.indexOf('=');

      if (separatorIndex <= 0) {
        continue;
      }

      const name = line.slice(0, separatorIndex).trim();
      let value = line.slice(separatorIndex + 1).trim();

      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      process.env[name] = value;
    }
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
    smtpHost: getOptionalString('SMTP_HOST'),
    smtpPort: getPositiveInteger('SMTP_PORT', 587),
    smtpSecure: getBoolean('SMTP_SECURE', false),
    smtpUser: getOptionalString('SMTP_USER') ?? getOptionalString('SMTP_FROM_EMAIL'),
    smtpPassword: getOptionalString('SMTP_PASSWORD') ?? getOptionalString('SMTP_PASS'),
    smtpFromEmail: getOptionalString('SMTP_FROM_EMAIL') ?? getOptionalString('SMTP_USER'),
    smtpFromName: getOptionalString('SMTP_FROM_NAME') ?? 'SafeRidePro',
    webAppOrigins: getStringList('WEB_APP_ORIGINS', ['http://localhost:3000']),
  };

  return cachedEnvironment;
}
