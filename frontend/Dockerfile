# syntax=docker/dockerfile:1.7
#
# QuataTrade web (Next.js App Router, standalone output).
# Build context is the REPO ROOT — the app imports @quatatrade/shared, so the
# workspace must be present:  docker build -f frontend/Dockerfile .

FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /app

FROM base AS manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY shared/package.json shared/
COPY backend/package.json backend/
COPY frontend/package.json frontend/

# --ignore-scripts: shared's `prepare` runs tsup, which fails here because only
# manifests exist at this layer. The build stage compiles shared explicitly.
FROM manifests AS deps
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --ignore-scripts \
      --filter frontend... --filter @quatatrade/shared...

FROM deps AS build
ENV NEXT_TELEMETRY_DISABLED=1
COPY shared/ shared/
COPY frontend/ frontend/
# shared must be built first: next.config transpiles it, but type resolution and
# the standalone trace both read its emitted dist.
RUN pnpm --filter @quatatrade/shared build \
 && pnpm --filter frontend build

# ── runtime ─────────────────────────────────────────────────────────────────
FROM base AS runtime
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN apt-get update \
 && apt-get install -y --no-install-recommends tini curl \
 && rm -rf /var/lib/apt/lists/*

# `standalone` already contains the traced node_modules, so nothing else is
# installed here. outputFileTracingRoot is the workspace root, so the emitted
# tree mirrors the workspace layout.
COPY --from=build --chown=node:node /app/frontend/.next/standalone ./
COPY --from=build --chown=node:node /app/frontend/.next/static ./frontend/.next/static
COPY --from=build --chown=node:node /app/frontend/public ./frontend/public

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3000/ >/dev/null || exit 1

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "frontend/server.js"]
