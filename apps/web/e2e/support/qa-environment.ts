import { copyFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const repoRoot = path.resolve(__dirname, '../../../..');
const qaEnvironmentPath = path.resolve(repoRoot, '.env.qa');
const qaEnvironmentTemplatePath = path.resolve(repoRoot, '.env.qa.example');
const qaHealthUrls = [
  'http://localhost:3001/api/health',
  'http://localhost:3000/healthz',
] as const;

function runRepoCommand(command: string, args: string[]) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  if (result.status !== 0) {
    throw new Error(`El comando ${command} ${args.join(' ')} fallo con codigo ${result.status ?? 1}.`);
  }
}

async function isUrlHealthy(url: string): Promise<boolean> {
  try {
    const response = await fetch(url);
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForHealthyUrl(url: string, timeoutMs: number): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    if (await isUrlHealthy(url)) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 3_000));
  }

  throw new Error(`El servicio ${url} no quedo saludable dentro del tiempo esperado.`);
}

function ensureQaEnvFile(): void {
  if (!existsSync(qaEnvironmentPath)) {
    copyFileSync(qaEnvironmentTemplatePath, qaEnvironmentPath);
  }
}

export async function ensureQaEnvironment(): Promise<void> {
  ensureQaEnvFile();

  const canReuseQaEnvironment =
    process.env.PLAYWRIGHT_REUSE_QA === 'true' &&
    (await Promise.all(qaHealthUrls.map((url) => isUrlHealthy(url)))).every(Boolean);

  if (!canReuseQaEnvironment) {
    runRepoCommand('corepack', ['pnpm', 'qa:up:build']);
  }

  await Promise.all(qaHealthUrls.map((url) => waitForHealthyUrl(url, 600_000)));
}
