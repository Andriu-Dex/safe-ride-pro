const { existsSync } = require('node:fs');
const { dirname, resolve } = require('node:path');
const { spawnSync } = require('node:child_process');

function loadEnvironmentFile() {
  if (typeof process.loadEnvFile !== 'function') {
    return;
  }

  const envPathCandidates = [
    resolve(process.cwd(), '.env'),
    resolve(process.cwd(), '../../.env'),
  ];

  const envPath = envPathCandidates.find((candidatePath) => existsSync(candidatePath));

  if (envPath) {
    process.loadEnvFile(envPath);
  }
}

function getTestDatabaseUrl() {
  const baseDatabaseUrl = process.env.DATABASE_URL?.trim();

  if (!baseDatabaseUrl) {
    throw new Error('DATABASE_URL es obligatorio para ejecutar test:db.');
  }

  const explicitTestDatabaseUrl = process.env.TEST_DATABASE_URL?.trim();

  if (explicitTestDatabaseUrl) {
    return explicitTestDatabaseUrl;
  }

  const schemaName = process.env.TEST_DATABASE_SCHEMA?.trim() || 'integration_tests';
  const parsedUrl = new URL(baseDatabaseUrl);

  parsedUrl.searchParams.set('schema', schemaName);

  return parsedUrl.toString();
}

function assertIsolatedSchema(baseDatabaseUrl, testDatabaseUrl) {
  const baseUrl = new URL(baseDatabaseUrl);
  const targetUrl = new URL(testDatabaseUrl);
  const baseSchema = baseUrl.searchParams.get('schema')?.trim() || 'public';
  const targetSchema = targetUrl.searchParams.get('schema')?.trim();

  if (!targetSchema) {
    throw new Error(
      'TEST_DATABASE_URL debe incluir un schema explicito para evitar tocar el schema principal.',
    );
  }

  if (targetSchema === baseSchema) {
    throw new Error(
      `Se bloqueo test:db porque el schema de pruebas (${targetSchema}) coincide con el schema principal.`,
    );
  }
}

function runNodeScript(scriptPath, args, env) {
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: process.cwd(),
    env,
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function resolvePackageBinary(packageName, binName) {
  const packageJsonPath = require.resolve(`${packageName}/package.json`);
  const packageJson = require(packageJsonPath);
  const declaredBinary = typeof packageJson.bin === 'string'
    ? packageJson.bin
    : packageJson.bin?.[binName];

  if (!declaredBinary) {
    throw new Error(`No se pudo resolver el binario ${binName} del paquete ${packageName}.`);
  }

  return resolve(dirname(packageJsonPath), declaredBinary);
}

function main() {
  loadEnvironmentFile();

  const baseDatabaseUrl = process.env.DATABASE_URL?.trim();

  if (!baseDatabaseUrl) {
    throw new Error('DATABASE_URL es obligatorio para ejecutar test:db.');
  }

  const testDatabaseUrl = getTestDatabaseUrl();
  assertIsolatedSchema(baseDatabaseUrl, testDatabaseUrl);

  const runtimeEnv = {
    ...process.env,
    NODE_ENV: 'test',
    DATABASE_URL: testDatabaseUrl,
    TEST_DATABASE_URL: testDatabaseUrl,
  };

  const prismaCliPath = resolvePackageBinary('prisma', 'prisma');
  const jestCliPath = resolvePackageBinary('jest', 'jest');
  const schemaName = new URL(testDatabaseUrl).searchParams.get('schema');

  console.log(`Running real DB integration tests on schema "${schemaName}"...`);

  runNodeScript(prismaCliPath, ['migrate', 'reset', '--force', '--skip-generate'], runtimeEnv);
  runNodeScript(jestCliPath, ['--config', './jest.db.config.js', '--runInBand'], runtimeEnv);
}

main();
