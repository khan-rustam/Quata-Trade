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
      name: "quatatrade-api",
      cwd: BACKEND,
      script: "dist/main.js",
      node_args: "--enable-source-maps",
    },
    {
      ...common,
      name: "quatatrade-worker",
      cwd: BACKEND,
      script: "dist/worker.js",
      node_args: "--enable-source-maps",
    },
    {
      ...common,
      name: "quatatrade-web",
      cwd: FRONTEND,
      // Next.js production server. `next build` output (.next) must exist first.
      script: "node_modules/next/dist/bin/next",
      args: "start",
      env: { PORT: WEB_PORT, NODE_ENV: "production" },
    },
  ],
};
