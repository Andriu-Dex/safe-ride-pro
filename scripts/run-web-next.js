const { existsSync, readdirSync } = require('node:fs');
const { spawnSync } = require('node:child_process');
const { dirname, resolve } = require('node:path');

const repoRoot = resolve(__dirname, '..');
const webDirectory = resolve(repoRoot, 'apps/web');

function resolveNextCli() {
  try {
    const nextPackageJsonPath = require.resolve('next/package.json', {
      paths: [webDirectory, repoRoot],
    });

    return resolve(dirname(nextPackageJsonPath), 'dist/bin/next');
  } catch {
    const pnpmStoreDirectory = resolve(repoRoot, 'node_modules/.pnpm');

    if (!existsSync(pnpmStoreDirectory)) {
      throw new Error('No se encontro el directorio node_modules/.pnpm para resolver Next.js.');
    }

    const nextStoreEntry = readdirSync(pnpmStoreDirectory).find((entryName) =>
      entryName.startsWith('next@'),
    );

    if (!nextStoreEntry) {
      throw new Error('No se encontro la instalacion de Next.js dentro de node_modules/.pnpm.');
    }

    return resolve(pnpmStoreDirectory, nextStoreEntry, 'node_modules/next/dist/bin/next');
  }
}

function main() {
  const nextCliPath = resolveNextCli();
  const result = spawnSync(process.execPath, [nextCliPath, ...process.argv.slice(2)], {
    cwd: webDirectory,
    env: process.env,
    stdio: 'inherit',
  });

  if (result.error) {
    throw result.error;
  }

  process.exit(result.status ?? 1);
}

main();
