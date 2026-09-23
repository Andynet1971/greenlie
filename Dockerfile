# syntax=docker/dockerfile:1
#
# Two targets, one file: `worker` (also runs migrations, via docker-compose.yml's
# `migrate` service) and `web`. Not alpine: Turbopack and SWC ship native binaries,
# and musl is one more variable for a few saved megabytes.

# ---- deps: install every workspace's dependencies ----------------------------
# Cached across builds as long as no package.json or the lockfile changes.
FROM node:24-slim AS deps
WORKDIR /repo
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/package.json
COPY packages/db/package.json packages/db/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci

# ---- build: the full monorepo, all four workspaces ----------------------------
FROM deps AS build
COPY . .
RUN npm run build

# ---- worker: production deps for @greenlie/worker only, plus the built output --
FROM node:24-slim AS worker
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1
LABEL org.opencontainers.image.source=https://github.com/Andynet1971/greenlie
WORKDIR /repo
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/package.json
COPY packages/db/package.json packages/db/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci --omit=dev -w @greenlie/worker
COPY --from=build /repo/packages/core/dist packages/core/dist
COPY --from=build /repo/packages/db/dist packages/db/dist
COPY --from=build /repo/packages/db/drizzle packages/db/drizzle
COPY --from=build /repo/apps/worker/dist apps/worker/dist
USER node
CMD ["node", "apps/worker/dist/main.js"]

# ---- web: Next's own standalone output, which already carries only what it needs --
FROM node:24-slim AS web
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
LABEL org.opencontainers.image.source=https://github.com/Andynet1971/greenlie
WORKDIR /app
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
