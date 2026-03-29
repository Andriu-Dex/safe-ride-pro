FROM node:24-alpine AS builder

WORKDIR /app

RUN corepack enable

ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:3001/api
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}

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
RUN pnpm --dir apps/web build

FROM node:24-alpine AS runner

WORKDIR /app

RUN corepack enable

COPY --from=builder /app /app

ENV NODE_ENV=production
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}
EXPOSE 3000

CMD ["pnpm", "--dir", "apps/web", "start"]
