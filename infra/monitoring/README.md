# QuataTrade Monitoring Stack

Containerized **Prometheus + Grafana + Uptime-Kuma + node-exporter**, deployed on the app VPS for
now, portable to a dedicated box later with **no application change**.

## What it monitors
- **Server** (node-exporter): CPU, RAM, disk, network, load.
- **Application** (API `/metrics`): request rate, latency (p50/p95/p99), errors, Node process
  memory + event-loop lag. Also the built-in `/status` + `/ready` health probes (via Uptime-Kuma).
- **Business** (API `/metrics`, computed from the DB): withdrawals/trades/deposits by status,
  stuck broadcasts (>2h), users, alerts in the last hour.
- **Security/ops signals** already flow to Telegram/email/webhook + the admin Alerts page
  (`AlertsService`) — Grafana is the trend view, alerting is the pager.

## Deploy (on the app VPS)
```bash
export GF_SECURITY_ADMIN_PASSWORD='<a strong password — not committed>'
docker compose -f infra/monitoring/docker-compose.yml up -d
docker compose -f infra/monitoring/docker-compose.yml ps
```
Ports (host networking; chosen to avoid 3000/3800 already used on this box):
Prometheus `127.0.0.1:9090` · Grafana `:3001` · Uptime-Kuma `:3002` · node-exporter `127.0.0.1:9100`.

> Prometheus + node-exporter bind **127.0.0.1** (local only). Put **Grafana** and **Uptime-Kuma**
> behind Nginx with TLS + auth if you want remote access (e.g. `monitor.quatatrade.com`), or reach
> them over the WireGuard/SSH tunnel. Never expose `/metrics` or Prometheus publicly.

## First-run setup
1. **Grafana** (`:3001`, login `admin` / your `GF_SECURITY_ADMIN_PASSWORD`): the Prometheus
   datasource + the **QuataTrade — App & Business** dashboard are auto-provisioned. For host
   metrics, import the community **Node Exporter Full** dashboard (Grafana.com ID **1860**).
2. **Prometheus** target check: `:9090` → Status → Targets — `quatatrade-api`, `node`, `prometheus`
   should be **UP**. If `quatatrade-api` is DOWN, confirm the API `PORT` in `prometheus.yml`
   (`backend/.env`, default 4000) and that the API is running.
3. **Uptime-Kuma** (`:3002`): create the admin user, then add HTTP monitors:
   - `http://127.0.0.1:<API_PORT>/ready` — expect 200 (503 = core dep down). **Primary uptime probe.**
   - `http://127.0.0.1:<API_PORT>/live` — process liveness.
   - `https://quatatrade.com` — public site.
   Add a Telegram notification in Uptime-Kuma (same bot) for redundancy with the app's own alerts.

## Migrate to a dedicated monitoring box later
1. `docker compose up -d` the same stack on the new box.
2. In `prometheus/prometheus.yml`, change the `quatatrade-api` + `node` targets from `127.0.0.1`
   to the app host's **private IP** (WireGuard/VPC), and scrape `/metrics` over that private link.
3. No application change — the API keeps exposing `/metrics` on its loopback/private interface.

## Files
- `docker-compose.yml` — the four services (host networking).
- `prometheus/prometheus.yml` — scrape config.
- `grafana/provisioning/**` — datasource + dashboard auto-provisioning.
- `grafana/dashboards/quatatrade-app.json` — the app+business dashboard.
