# 16 — Domains, Subdomains & DNS Plan

> You register **one** domain: `quatatrade.com` (already owned). Everything below is a **subdomain**
> — a free DNS record you create at your registrar/DNS host. You do **not** need to buy more domains.
> Get **one wildcard TLS certificate** `*.quatatrade.com` (+ apex) via Let's Encrypt/certbot so you
> never manage per-subdomain certs. Maps to the architecture in Documents/03.

## The short answer
- **Domains to buy:** 0 more (you have `quatatrade.com`).
- **Public subdomains at launch:** 4 core (`www`/apex, `api`, `cdn`, `status`) — 5 hostnames.
- **+ Admin:** 1 (subdomain **or** keep the `/admin` path — see notes).
- **Internal/ops (access-restricted, not for the public):** ~4.
- **Staging mirror (recommended):** ~3.
- **Never exposed:** the signer host (WireGuard-only, no DNS).
- **Total DNS records:** ~13–15, all under the one domain.

## A. Public — production (must-have, TLS, behind Nginx on Host A)

| Hostname | Points to | Purpose | Notes |
|---|---|---|---|
| `quatatrade.com` (apex) | Web app (Next.js) | Marketing + user app + admin path | Pick apex **or** `www` as canonical; redirect the other |
| `www.quatatrade.com` | → apex | Redirect | 301 to the canonical |
| `api.quatatrade.com` | Backend API (NestJS/Fastify) | REST API + Socket.IO (WebSocket upgrade) | The frontend's `NEXT_PUBLIC_API_URL`; set CORS to the web origin |
| `cdn.quatatrade.com` (or `storage.` / `s3.`) | MinIO S3 endpoint | Serves **presigned** file URLs (KYC, proofs, chat) | Buckets stay private; only short-TTL presigned links work |
| `status.quatatrade.com` | Uptime Kuma | Public status page (P24) | The one ops tool that IS public |

> Realtime chat runs over the **same `api.` host** (Socket.IO upgrades the HTTP connection) — no
> separate `ws.` subdomain needed unless you later scale sockets to their own service.

## B. Admin — pick ONE

| Option | Hostname | Trade-off |
|---|---|---|
| Path (current build) | `quatatrade.com/admin` | Simplest; already works. Admin uses in-memory tokens (no shared cookies), so it's already isolated. |
| Subdomain (more locked-down) | `admin.quatatrade.com` | Lets you **IP-allowlist / firewall** the admin at the edge and put it behind a separate Nginx rule. Same Next.js app — just a routing/host rule. Recommended once you have staff IPs to allowlist. |

## C. Internal / ops — RESTRICT (VPN or IP-allowlist; never open to the public)

| Hostname | Tool | Why restricted |
|---|---|---|
| `grafana.quatatrade.com` | Grafana | Dashboards (trade volume, hot-wallet balance, chain-lag, reconciliation) |
| `errors.quatatrade.com` | GlitchTip (OSS Sentry) | Exception traces — may contain sensitive context |
| `secrets.quatatrade.com` | Infisical | Secrets manager — **VPN-only**, most sensitive |
| `minio.quatatrade.com` | MinIO console (admin UI) | Storage administration (separate from the `cdn.` data endpoint) |

> Prometheus itself usually stays **internal-only** (scraped inside the private network, viewed
> through Grafana) — it does not need a public subdomain.

## D. Staging (strongly recommended — a small mirror on a separate VPS)

| Hostname | Points to |
|---|---|
| `staging.quatatrade.com` | Staging web app |
| `api.staging.quatatrade.com` | Staging API |
| `cdn.staging.quatatrade.com` | Staging MinIO (optional) |

> Staging runs against TRON **Shasta/Nile testnet** (Documents/03) — real end-to-end without mainnet risk.

## E. Never gets a public subdomain (by design)

- **The signer host (Host B)** — holds hot-wallet keys, **no inbound internet**, reachable only over
  the WireGuard tunnel from Host A (Documents/03). It must **not** have a DNS record.
- **PostgreSQL, Redis, worker** — internal services on the private network; never publicly resolvable.

## F. Email — DNS records on `quatatrade.com` (not subdomains you "visit")

You don't create visitable subdomains for email, but you MUST set these DNS records so mail is
trusted and not spam-filtered:

| Record | Purpose |
|---|---|
| `MX` | Where mail for `@quatatrade.com` is delivered (your inbox provider) |
| `SPF` (TXT) | Authorizes your sending provider (SMTP/transactional) |
| `DKIM` (TXT) | Signs outgoing mail (provider gives you the record) |
| `DMARC` (TXT `_dmarc`) | Policy for failed SPF/DKIM |

Mailboxes to create on the domain (addresses, not subdomains): `support@`, `legal@`, `abuse@`,
`no-reply@` (transactional sender).

## G. Certificates & DNS mechanics
- **One wildcard cert** `*.quatatrade.com` **+** apex `quatatrade.com` (Let's Encrypt DNS-01, or per-host HTTP-01). Covers every subdomain above except staging (staging can share if you issue `*.staging.quatatrade.com`, or use its own).
- Records are **A/AAAA** (to the Host A public IP) for services on Host A, or **CNAME** to a provider (e.g. status page, if hosted). Point apex + `www`, `api`, `cdn`, `status`, and the ops subdomains at Host A; staging at the staging VPS IP.
- Turn on the registrar's DNS **proxy/CDN + WAF** (e.g. Cloudflare) for the public hostnames if you want edge caching, DDoS protection, and easy IP-allowlisting for the admin/ops subdomains.

## H. Copy-paste checklist to send yourself / your ops
```
quatatrade.com            A/AAAA  -> Host A      (web)          [public]
www.quatatrade.com        CNAME   -> quatatrade.com (redirect)  [public]
api.quatatrade.com        A/AAAA  -> Host A      (API + WS)     [public]
cdn.quatatrade.com        A/AAAA  -> Host A      (MinIO data)   [public, private buckets]
status.quatatrade.com     A/CNAME -> Uptime Kuma                [public]
admin.quatatrade.com      A/AAAA  -> Host A      (optional)     [restrict]
grafana.quatatrade.com    A/AAAA  -> Host A                     [restrict]
errors.quatatrade.com     A/AAAA  -> Host A                     [restrict]
secrets.quatatrade.com    A/AAAA  -> Host A                     [VPN only]
minio.quatatrade.com      A/AAAA  -> Host A      (console)      [restrict]
staging.quatatrade.com    A/AAAA  -> Host B(staging VPS)        [restrict/public]
api.staging.quatatrade.com A/AAAA -> staging VPS                [restrict]
# signer host: NO DNS record — WireGuard tunnel only
# email: MX, SPF, DKIM, DMARC on quatatrade.com
```
