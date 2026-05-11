Herramientas usadas

Jest
ts-jest
TypeScript
mocks con jest.fn()


Comandos para hacer los test de:  inicio de sesión, registro, recuperación de contraseña y edición de usuario.

corepack pnpm --filter @saferidepro/api test:priority:auth-profile



corepack pnpm --filter @saferidepro/api exec jest --config ./jest.config.js --runInBand --verbose test/unit/auth/login.use-case.spec.ts test/unit/auth/register-user.use-case.spec.ts test/unit/auth/forgot-password.use-case.spec.ts test/unit/auth/reset-password.use-case.spec.ts test/unit/users/update-current-user.use-case.spec.ts




corepack pnpm --filter @saferidepro/api exec jest --config ./jest.config.js --runInBand --verbose --coverage test/unit/auth/login.use-case.spec.ts test/unit/auth/register-user.use-case.spec.ts test/unit/auth/forgot-password.use-case.spec.ts test/unit/auth/reset-password.use-case.spec.ts test/unit/users/update-current-user.use-case.spec.ts



---


corepack pnpm --filter @saferidepro/web test:priority:auth-profile