# SafeRidePro

SafeRidePro is a multi-institution student ride-sharing platform organized as a monorepo with a clean architecture foundation.

## Workspace layout

- `apps/api`: NestJS backend
- `apps/web`: Next.js web client
- `apps/mobile`: Expo mobile placeholder
- `packages/shared-types`: shared TypeScript types
- `packages/eslint-config`: shared ESLint configs
- `packages/tsconfig`: shared TypeScript configs
- `Docs`: product and architecture documentation

## Getting started

1. Install dependencies with `pnpm install`
2. Copy the environment files you need:
   - `Copy-Item .env.example .env`
   - `Copy-Item apps/api/.env.example apps/api/.env`
   - `Copy-Item apps/web/.env.example apps/web/.env.local`
3. Run the API with `corepack pnpm --dir apps/api dev`
4. Run the web app with `corepack pnpm --dir apps/web dev`
5. Build the apps with `corepack pnpm --dir apps/api build` and `corepack pnpm --dir apps/web build`

## Identity & Access v2

The first post-MVP phase already includes:

- institutional registration on the web
- email verification by code
- resend verification code
- login with refresh token support
- forgot password and reset password
- logout and session refresh
- basic auth rate limiting and auth audit events

For local development without a real email provider, keep `AUTH_ALLOW_DEBUG_CODES=true`.
For real email delivery, configure `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, and `RESEND_FROM_NAME`.

## Notes

- Source code must stay in English.
- User-facing content must stay in Spanish.
- The current workspace is a scaffold and is ready for incremental implementation.
