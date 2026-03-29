const { spawnSync } = require('node:child_process');
const { dirname, resolve } = require('node:path');

function resolvePrismaCli() {
  const prismaPackageJsonPath = require.resolve('prisma/package.json');

  return resolve(dirname(prismaPackageJsonPath), 'build/index.js');
}

function main() {
  const prismaCliPath = resolvePrismaCli();
  const result = spawnSync(process.execPath, [prismaCliPath, ...process.argv.slice(2)], {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
  });

  if (result.error) {
    throw result.error;
  }

  process.exit(result.status ?? 1);
}

main();
