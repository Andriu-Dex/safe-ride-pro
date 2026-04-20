FROM node:24-alpine AS builder

WORKDIR /app

RUN corepack enable

ENV PRISMA_SKIP_POSTINSTALL_GENERATE=true

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/mobile/package.json apps/mobile/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
COPY packages/tsconfig/package.json packages/tsconfig/package.json
COPY packages/eslint-config/package.json packages/eslint-config/package.json

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm exec tsc --project packages/shared-types/tsconfig.json
RUN node scripts/run-api-prisma.js generate
RUN pnpm --dir apps/api build

FROM node:24-alpine AS runner

WORKDIR /app

RUN corepack enable

COPY --from=builder --chown=node:node /app /app

RUN mkdir -p /app/storage/private && chown -R node:node /app/storage

ENV NODE_ENV=production
ENV PRISMA_HIDE_UPDATE_MESSAGE=true
EXPOSE 3001

USER node

CMD ["sh", "-c", "node scripts/run-api-prisma.js migrate deploy && node scripts/run-api-prisma.js db seed && node apps/api/dist/main.js"]
