FROM node:24-alpine AS development
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.10.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
CMD ["sh", "-c", "pnpm db:migrate && pnpm db:seed && pnpm server"]

FROM development AS build
RUN pnpm build

FROM node:24-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build --chown=node:node /app /app
USER node
CMD ["sh", "-c", "./node_modules/.bin/tsx scripts/migrate.ts && ./node_modules/.bin/tsx scripts/seed.ts && ./node_modules/.bin/tsx src/backend/server/main.ts"]
