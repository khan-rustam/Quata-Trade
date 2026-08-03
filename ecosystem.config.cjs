/**
 * pm2 process definitions for QuataTrade — and ONLY QuataTrade.
 *
 * This box runs other unrelated projects, so we never use `pm2 restart all`.
 * `deploy.sh` runs `pm2 startOrReload ecosystem.config.cjs`, which starts these
 * three apps if missing and gracefully reloads them if present — without ever
 * touching any process that is not listed here.
 *
 * The signer service is human-written, key-holding, and lives on a separate
 * host. It is intentionally absent here and must never be managed from this repo.
 *
 * Config notes:
 *  - API + worker read backend/.env (cwd = backend/), so we do NOT inject
 *    NODE_ENV/PORT here — backend/.env is the single source of truth. (Forcing
 *    NODE_ENV=production would trip the SIGNER_MODE=mock hard-stop on the test
 *    box, which runs NODE_ENV=staging.)
 *  - The web process has no .env for its port, so we pass PORT explicitly.
 *    Nginx proxies quatatrade.com -> 127.0.0.1:3800, so the web app
 *    MUST listen on 3800 (port 3000 is used by another project on this box).
 *    Override with QT_WEB_PORT if the nginx upstream ever changes.
 */
const path = require("path");

const ROOT = __dirname;
const BACKEND = path.join(ROOT, "backend");
const FRONTEND = path.join(ROOT, "frontend");
const WEB_PORT = process.env.QT_WEB_PORT || "3800";

const common = {
  exec_mode: "fork",
  // Must stay 1 until the rate limiter uses shared storage: throttler's default
  // in-memory counters are per-process, so N instances = N x every rate limit
  // (see backend/src/app.module.ts).
  instances: 1,
  autorestart: true,
  max_restarts: 10,
  restart_delay: 3000,
  max_memory_restart: "700M",
  time: true, // timestamped logs
};

module.exports = {
  apps: [
    {
      ...common,
      name: "QuataTrade-S",
      cwd: BACKEND,
      script: "dist/main.js",
      node_args: "--enable-source-maps",
    },
    {
      ...common,
      name: "QuataTrade-W",
      cwd: BACKEND,
      script: "dist/worker.js",
      node_args: "--enable-source-maps",
    },
    {
      ...common,
      name: "QuataTrade-F",
      cwd: FRONTEND,
      // Next.js production server. `next build` output must exist first.
      //
      // frontend/next.config.ts sets `output: "standalone"`, which Next
      // explicitly does not support under `next start` — it warned on every
      // boot and left the live process serving a .next/ tree that the next
      // build was overwriting underneath it. That is what produced the
      // MODULE_NOT_FOUND / ChunkLoadError burst on the /account/kyc chunk.
      //
      // The path is nested: outputFileTracingRoot is the monorepo root, so
      // Next mirrors the app's path and emits standalone/frontend/server.js.
      // deploy.sh copies .next/static + public/ in after each build.
      //
      // PORT is read from the env by the standalone server (it ignores CLI
      // flags). HOSTNAME is deliberately not set, so it keeps binding
      // 0.0.0.0 exactly as `next start` did — nginx fronts it and ufw is on.
      script: ".next/standalone/frontend/server.js",
      env: { PORT: WEB_PORT, NODE_ENV: "production" },
    },
  ],
};
