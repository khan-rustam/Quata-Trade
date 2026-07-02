# 17 — Testing Deployment on quatadigital.com (subdomains + env)

> Host the **test** build under your existing `quatadigital.com` on **one VPS**. When you later buy
> the production domain (`quatatrade.com`) you only change **env values + DNS** — nothing in the code.
> The test env uses `SIGNER_MODE=mock` and `NODE_ENV=staging` (real signer / Host B not needed yet).

## What to create — 3 subdomains (all point to the ONE test VPS)

| Subdomain | Serves | Required? |
|---|---|---|
| `trade.quatadigital.com` | Web app (Next.js) — marketing + user app + admin at `/admin` | ✅ yes |
| `api.trade.quatadigital.com` | Backend API (NestJS) + live chat (Socket.IO on the same host) | ✅ yes |
| `cdn.trade.quatadigital.com` | MinIO — serves KYC/proof files via short-lived presigned URLs | ✅ yes (needed for KYC/file features) |
| `status.trade.quatadigital.com` | Uptime Kuma status page | ⬜ optional |
| `grafana.trade.quatadigital.com` | Monitoring (IP-restrict) | ⬜ optional |

- **Admin needs no subdomain** — it's the `/admin` path on `trade.quatadigital.com`.
- **No signer host, no WireGuard, no Postgres/Redis subdomain** — those stay inside the VPS (private).

## DNS records (at your quatadigital.com DNS host)
```
trade.quatadigital.com        A/AAAA -> <test VPS public IP>
api.trade.quatadigital.com    A/AAAA -> <test VPS public IP>
cdn.trade.quatadigital.com    A/AAAA -> <test VPS public IP>
# optional:
status.trade.quatadigital.com A/AAAA -> <test VPS public IP>
```
All three point to the **same** IP; Nginx on the VPS routes by hostname to web / api / minio.

## TLS certificate (important nesting note)
These are **second-level** subdomains (`x.trade.quatadigital.com`). A wildcard `*.quatadigital.com`
does **NOT** cover them. Use **one** of:
- a wildcard **`*.trade.quatadigital.com`** (+ `trade.quatadigital.com`) via Let's Encrypt DNS-01, **or**
- individual Let's Encrypt certs (HTTP-01) for the 3 hostnames (simplest with certbot + Nginx).

## App config that maps to these hostnames

**backend `.env`** (on the VPS):
```
NODE_ENV=staging
PORT=4000
WEB_ORIGIN=https://trade.quatadigital.com          # CORS + cookie origin
DATABASE_URL=postgres://quatatrade_app:...@postgres:5432/quatatrade
REDIS_URL=redis://redis:6379
MINIO_ENDPOINT=cdn.trade.quatadigital.com
MINIO_PORT=443
MINIO_USE_SSL=true
SIGNER_MODE=mock                                    # allowed because NODE_ENV != production
TRON_NETWORK=shasta                                 # testnet
SWAGGER_ENABLED=true                                # ok on staging
# strong secrets (generate fresh): JWT_ACCESS_SECRET, MASTER_ENCRYPTION_KEY (32-byte base64)
```

**frontend `.env.local`** (build-time):
```
NEXT_PUBLIC_API_URL=https://api.trade.quatadigital.com
NEXT_PUBLIC_SITE_URL=https://trade.quatadigital.com
```

> Cross-subdomain auth works: `trade.` and `api.trade.` share the same registrable domain
> (`quatadigital.com`), so they are **same-site** — the httpOnly refresh cookie and `SameSite`
> rules work between them with `credentials: include` + CORS allowing `WEB_ORIGIN`. No cookie
> `Domain` juggling needed.

## Email (so testers receive OTP codes)
Verification and reset codes are emailed. For the test env either:
- point the notify module at a transactional provider (Brevo/Resend/Postmark/Mailgun) using a
  `no-reply@quatadigital.com` sender (set SPF/DKIM), **or**
- for a quick internal test, run **Mailpit** on the VPS and read codes from its inbox, **or**
- read the OTP straight from the `auth_tokens` table / notifications during testing.

## One-VPS layout (what runs where)
```
VPS (Ubuntu) — Docker Compose:
  nginx        :443  -> routes by host:
                         trade.*        -> web (Next.js :3000)
                         api.trade.*    -> api (NestJS :4000)  (+ WebSocket upgrade)
                         cdn.trade.*    -> minio (:9000)
  web (Next.js), api (NestJS), worker (BullMQ crons)
  postgres, redis, minio        (private — no public port)
  # signer = mock (in-process); no Host B for testing
```

## Later: switching to production (quatatrade.com)
No code changes — only:
1. Point production DNS: `quatatrade.com`, `api.quatatrade.com`, `cdn.quatatrade.com` → prod VPS (Documents/16).
2. Change env: `NODE_ENV=production`, `WEB_ORIGIN=https://quatatrade.com`, `NEXT_PUBLIC_API_URL=https://api.quatatrade.com`, `MINIO_ENDPOINT=cdn.quatatrade.com`, `TRON_NETWORK=mainnet`, and **`SIGNER_MODE=remote`** with the real isolated signer on Host B.
3. Because the hostnames are all env-driven, the app is identical — you just rebuild the frontend with the new `NEXT_PUBLIC_*` and restart the API with the new env.
