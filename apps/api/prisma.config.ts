import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, env } from 'prisma/config';

const envPathCandidates = [
  resolve(process.cwd(), 'apps/api/.env'),
  resolve(process.cwd(), '.env'),
];

const envPath = envPathCandidates.find((candidatePath) => existsSync(candidatePath));

if (envPath && typeof process.loadEnvFile === 'function') {
  process.loadEnvFile(envPath);
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'node ../../scripts/run-api-seed.js',
  },
  engine: 'classic',
  datasource: {
    url: env('DATABASE_URL'),
  },
});
