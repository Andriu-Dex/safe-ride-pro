const { existsSync, readdirSync } = require('node:fs');
const { spawnSync } = require('node:child_process');
const { dirname, resolve } = require('node:path');

const repoRoot = resolve(__dirname, '..');
const apiDirectory = resolve(repoRoot, 'apps/api');

function resolveTsNodeCli() {
  try {
    const tsNodePackageJsonPath = require.resolve('ts-node/package.json', {
      paths: [apiDirectory, repoRoot],
    });

    return resolve(dirname(tsNodePackageJsonPath), 'dist/bin.js');
  } catch {
    const pnpmStoreDirectory = resolve(repoRoot, 'node_modules/.pnpm');

    if (!existsSync(pnpmStoreDirectory)) {
      throw new Error('No se encontro el directorio node_modules/.pnpm para resolver ts-node.');
    }

    const tsNodeStoreEntry = readdirSync(pnpmStoreDirectory).find((entryName) =>
      entryName.startsWith('ts-node@'),
    );

    if (!tsNodeStoreEntry) {
      throw new Error('No se encontro la instalacion de ts-node dentro de node_modules/.pnpm.');
    }

    return resolve(pnpmStoreDirectory, tsNodeStoreEntry, 'node_modules/ts-node/dist/bin.js');
  }
}

function main() {
  const tsNodeCliPath = resolveTsNodeCli();
  const result = spawnSync(
    process.execPath,
    [tsNodeCliPath, '--project', 'tsconfig.json', 'prisma/seed.ts'],
    {
      cwd: apiDirectory,
      env: process.env,
      stdio: 'inherit',
    },
  );

  if (result.error) {
    throw result.error;
  }

  process.exit(result.status ?? 1);
}

main();
