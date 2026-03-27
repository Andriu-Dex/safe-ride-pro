# SafeRidePro

SafeRidePro is a multi-institution student ride-sharing platform organized as a monorepo with a clean architecture foundation.

## Workspace layout

- `apps/api`: NestJS backend
- `apps/web`: Next.js web client
- `apps/mobile`: Expo mobile placeholder
- `packages/shared-types`: shared TypeScript types
- `packages/eslint-config`: shared ESLint configs
- `packages/tsconfig`: shared TypeScript configs
- `Doc`: product and architecture documentation

## Getting started

1. Install dependencies with `pnpm install`
2. Run the workspace with `pnpm dev`
3. Build all apps with `pnpm build`

## Notes

- Source code must stay in English.
- User-facing content must stay in Spanish.
- The current workspace is a scaffold and is ready for incremental implementation.
