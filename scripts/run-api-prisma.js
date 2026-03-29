const { existsSync, readdirSync } = require('node:fs');
const { spawnSync } = require('node:child_process');
const { dirname, resolve } = require('node:path');

const repoRoot = resolve(__dirname, '..');
const apiDirectory = resolve(repoRoot, 'apps/api');

function resolvePrismaCli() {
  try {
    const prismaPackageJsonPath = require.resolve('prisma/package.json', {
      paths: [repoRoot],
    });

    return resolve(dirname(prismaPackageJsonPath), 'build/index.js');
  } catch {
    const pnpmStoreDirectory = resolve(repoRoot, 'node_modules/.pnpm');

    if (!existsSync(pnpmStoreDirectory)) {
      throw new Error('No se encontro el directorio node_modules/.pnpm para resolver Prisma.');
    }

    const prismaStoreEntry = readdirSync(pnpmStoreDirectory).find((entryName) =>
      entryName.startsWith('prisma@'),
    );

    if (!prismaStoreEntry) {
      throw new Error('No se encontro la instalacion de Prisma dentro de node_modules/.pnpm.');
    }

    return resolve(
      pnpmStoreDirectory,
      prismaStoreEntry,
      'node_modules/prisma/build/index.js',
    );
  }
}

function main() {
  const prismaCliPath = resolvePrismaCli();
  const result = spawnSync(process.execPath, [prismaCliPath, ...process.argv.slice(2)], {
    cwd: apiDirectory,
    env: process.env,
    stdio: 'inherit',
  });

  if (result.error) {
    throw result.error;
  }

  process.exit(result.status ?? 1);
}

main();
