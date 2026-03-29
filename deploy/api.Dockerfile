FROM node:24-alpine AS builder

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/mobile/package.json apps/mobile/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
COPY packages/tsconfig/package.json packages/tsconfig/package.json
COPY packages/eslint-config/package.json packages/eslint-config/package.json

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm --dir apps/api prisma:generate
RUN pnpm --dir apps/api build

FROM node:24-alpine AS runner

WORKDIR /app

RUN corepack enable

COPY --from=builder /app /app

ENV NODE_ENV=production
EXPOSE 3001

CMD ["sh", "-c", "pnpm --dir apps/api prisma:generate && pnpm --dir apps/api db:deploy && pnpm --dir apps/api db:seed && pnpm --dir apps/api start"]
