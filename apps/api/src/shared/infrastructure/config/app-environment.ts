import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

export type AppEnvironment = {
  port: number;
  databaseUrl: string;
  jwtSecret: string;
  emailVerificationTokenTtlMinutes: number;
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

export function getAppEnvironment(): AppEnvironment {
  if (cachedEnvironment) {
    return cachedEnvironment;
  }

  loadEnvironmentFile();

  cachedEnvironment = {
    port: getPositiveInteger('PORT', 3001),
    databaseUrl: getRequiredString('DATABASE_URL'),
    jwtSecret: getRequiredString('JWT_SECRET'),
    emailVerificationTokenTtlMinutes: getPositiveInteger(
      'EMAIL_VERIFICATION_TOKEN_TTL_MINUTES',
      30,
    ),
    webAppOrigins: getStringList('WEB_APP_ORIGINS', ['http://localhost:3000']),
  };

  return cachedEnvironment;
}
