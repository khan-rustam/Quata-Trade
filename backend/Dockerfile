# syntax=docker/dockerfile:1.7
#
# QuataTrade API + worker. One image, two entrypoints — `node dist/main.js` (API)
# and `node dist/worker.js` (BullMQ processors) — because they share the same
# compiled tree and the same dependency set (Documents/03: modular monolith).
#
# Build context is the REPO ROOT, not backend/, because this is a pnpm workspace
# and the build needs pnpm-lock.yaml, pnpm-workspace.yaml and shared/ (the FE/BE
# contract). Build with:  docker build -f backend/Dockerfile .
#
# bookworm-slim rather than alpine: argon2 is a native module and glibc has far
# better prebuild coverage than musl, so this avoids compiling it from source.

FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    NODE_ENV=production
RUN corepack enable
WORKDIR /app

# ── dependency layer ────────────────────────────────────────────────────────
# Only manifests are copied so this layer caches until a package.json changes.
FROM base AS manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY shared/package.json shared/
COPY backend/package.json backend/
COPY frontend/package.json frontend/

# --ignore-scripts here too: shared/package.json's `prepare` runs tsup, but at this
# point only manifests exist, so it fails with "No input files". The build stage
# compiles shared explicitly instead, which is the correct order anyway.
# @swc/core is rebuilt because Nest's compiler uses it.
FROM manifests AS deps
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --ignore-scripts \
      --filter @quatatrade/backend... --filter @quatatrade/shared... \
 && pnpm rebuild @swc/core

# Production-only tree for the runtime stage.
#
# --ignore-scripts is required, not cosmetic: shared/package.json has a `prepare`
# script that runs tsup, and tsup is a devDependency — so a --prod install would
# always fail trying to run it. Skipping scripts is also the posture Documents/08
# §H asks for (no postinstall from unaudited packages).
#
# argon2 is the one dependency that genuinely needs attention here: it ships
# prebuilt binaries and resolves them via node-gyp-build at REQUIRE time, so it
# works without its install script. The smoke test below proves that rather than
# assuming it — a silently broken argon2 means nobody can log in.
FROM manifests AS prod-deps
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --prod --ignore-scripts \
      --filter @quatatrade/backend... --filter @quatatrade/shared... \
 && pnpm rebuild argon2
# cwd matters: pnpm's isolated layout puts argon2 under backend/node_modules,
# so this only resolves from the package that declares it.
RUN cd backend \
 && node -e "const a=require('argon2'); a.hash('probe').then(h=>{if(!h.startsWith('\$argon2'))throw new Error('bad hash');console.log('argon2 prebuild OK')})"

# ── build ───────────────────────────────────────────────────────────────────
FROM deps AS build
COPY shared/ shared/
COPY backend/ backend/
# shared first — backend imports its emitted types (quatatrade-api-contract).
RUN pnpm --filter @quatatrade/shared build \
 && pnpm --filter @quatatrade/backend build

# ── runtime ─────────────────────────────────────────────────────────────────
FROM base AS runtime

# tini reaps zombies and forwards SIGTERM, so BullMQ workers and Nest shutdown
# hooks actually run on `docker stop` instead of being SIGKILLed.
RUN apt-get update \
 && apt-get install -y --no-install-recommends tini curl \
 && rm -rf /var/lib/apt/lists/*

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/backend/node_modules ./backend/node_modules
COPY --from=prod-deps /app/shared/node_modules ./shared/node_modules
COPY --from=build /app/shared/dist ./shared/dist
COPY --from=build /app/shared/package.json ./shared/package.json
COPY --from=build /app/backend/dist ./backend/dist
COPY --from=build /app/backend/package.json ./backend/package.json
# migrations are run as a one-shot command against this same image
COPY --from=build /app/backend/src/db ./backend/src/db

WORKDIR /app/backend

# Never root (Documents/08 §G: containers run as non-root). `node` is uid 1000
# and already exists in the base image.
USER node

EXPOSE 4000

# The API exposes /health/ready; the worker overrides this in compose since it
# has no HTTP listener.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD curl -fsS http://127.0.0.1:4000/health/ready || exit 1

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "dist/main.js"]
