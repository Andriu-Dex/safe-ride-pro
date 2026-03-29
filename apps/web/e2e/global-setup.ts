import { ensureQaEnvironment } from './support/qa-environment';

async function globalSetup() {
  await ensureQaEnvironment();
}

export default globalSetup;
