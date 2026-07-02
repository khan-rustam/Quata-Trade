# 12 — Claude Code Skills, Plugins & Connectors for QuataTrade

> Curated setup for the developer's Claude Code environment. Tiered by trust. Rule zero: skills execute code in your environment — for a money codebase, install only from the official Anthropic marketplace or well-known repos whose SKILL.md you have read. **Never install any plugin/MCP on the signer host.**

## 12.0 How installation works
- Official marketplace is pre-registered. Interactive browser: `/plugin` → Discover tab.
- Install: `/plugin install <name>@claude-plugins-official`
- Add a community marketplace: `/plugin marketplace add <github-org/repo>` then `/plugin install <name>@<repo>`
- Manual skill install: clone the repo, copy the skill folder into `.claude/skills/` (project) or `~/.claude/skills/` (global). Project-level preferred so it's versioned with the repo.
- MCP servers: `claude mcp add <name> ...` or bundled inside plugins.

## 12.1 Tier 1 — Official Anthropic plugins (install these)

| Plugin | Why for QuataTrade | Install |
|---|---|---|
| **security-guidance** | Reviews every change Claude makes for common vulnerabilities and fixes them in-session; supports project-specific rules — add our §08 checklist items as rules. The single most valuable plugin for this repo. | `/plugin install security-guidance@claude-plugins-official` |
| **pr-review-toolkit** | Specialized review agents for PRs — use on every money-path PR before your human line-by-line pass. | `/plugin install pr-review-toolkit@claude-plugins-official` |
| **commit-commands** | Clean commit/push/PR workflows — keeps audit-gate commits tidy. | `/plugin install commit-commands@claude-plugins-official` |
| **Playwright (MCP)** | Browser automation for our Phase-7 E2E suite; Claude can drive/debug tests it writes. | `/plugin` → Discover → playwright |
| **TypeScript LSP / code-intelligence** | Live type errors after each edit — your #1 review superpower gets automated feedback. Install the TS language-server plugin from the official marketplace (code intelligence category). | `/plugin` → Discover → typescript |
| **claude-md-management** | Audits and maintains `CLAUDE.md` project memory as the repo grows. | `/plugin install claude-md-management@claude-plugins-official` |
| **skill-creator** (built-in skill) | Used in 12.4 to turn our own docs into custom skills. | already available |

## 12.2 Tier 2 — Community skills worth adding (read SKILL.md first)

| Skill / repo | What it gives us | Source |
|---|---|---|
| **obra/superpowers** | 20+ battle-tested skills: TDD loop, systematic-debugging, brainstorming/planning. TDD + systematic-debugging map directly onto our "tests-first on money paths" rule. | `github.com/obra/superpowers` |
| **Karpathy behavioral skill** | Four hard rules: no silent assumptions, minimal solutions, don't touch unrequested code, verify before shipping. Exactly the failure modes that are dangerous in ledger/escrow code. Merge into our CLAUDE.md. | `github.com/multica-ai/andrej-karpathy-skills` (`npx @swarmclawai/andrej-karpathy-skills --agent claude --dest .`) |
| **owasp-security** | OWASP Top 10:2025 + ASVS 5.0 code-review checklists with language-specific patterns — complements §08. | via BehiSecc/awesome-claude-skills index |
| **Trail of Bits security skills** | Static analysis with Semgrep/CodeQL, code auditing, fix verification — from a real security firm; run at each audit gate. | `github.com/trailofbits` (skills repo) |
| **varlock / secret-guard** | Ensures secrets never appear in Claude sessions, terminals, logs, or commits — non-negotiable here. | via awesome-claude-skills index |
| **systematic-debugging** | Root-cause-before-fix methodology for bugs/test failures. | part of superpowers |
| **webapp-testing** | Playwright-driven local app testing/verification loops. | Anthropic skills repo (`github.com/anthropics/skills`) |
| **frontend/UI design skill** (e.g. ui-ux-pro-max) | Accessibility-checked design-system output — pair with our Part 11 tokens; the skill assists, Part 11 decides. | `github.com/nextlevelbuilder/ui-ux-pro-max-skill` |

Discovery directories when you need something specific: `skills.sh` (Vercel), `claudemarketplaces.com`, `claude.com/plugins`, and the `travisvn/awesome-claude-skills` + `ComposioHQ/awesome-claude-skills` lists.

## 12.3 MCP connectors for this project

| Connector | Use | Caution |
|---|---|---|
| **Postgres MCP** (or Prisma Postgres MCP) | Let Claude inspect schema and run queries against **dev/test DB only** while building ledger/escrow. | Read-only role; NEVER point at staging/prod. |
| **GitHub MCP (official)** | Issues, PRs, reviews from inside Claude Code — pairs with audit-gate workflow. | Fine-grained PAT, this repo only. |
| **Playwright MCP** | E2E authoring/debugging (same as Tier 1 plugin). | Test envs only. |
| **Context7 (Upstash)** | Live version-specific docs for NestJS 11 / Next 15 / viem / tronweb — kills hallucinated APIs, our biggest AI-code risk. | Read-only, low risk. |
| **Sentry/GlitchTip MCP** (post-launch) | Triage production errors from the terminal. | Scoped token. |

Config note: put dev-only MCP servers in `.mcp.json` at repo root (checked in, no secrets; tokens via env).

## 12.4 Custom skills to CREATE from our own docs (highest value of all)

Generic skills don't know our ledger rules. Use `skill-creator` to package Parts 01–11 into project skills in `.claude/skills/`:

1. **quatatrade-ledger** — from §04 + §08A/B: postJournal contract, BIGINT-only, serializable+sorted-FOR-UPDATE pattern, idempotency; includes a "never do" list. Trigger: any ledger/fees work.
2. **quatatrade-escrow-fsm** — from §04.5 + §08C: transition table, same-tx event rule, dispute freeze. Trigger: trades/escrow/disputes.
3. **quatatrade-security-gates** — from §05 + §08: which gate applies, checklist emission into `docs/audits/gate-N.md`. Trigger: "audit", "gate", merging money paths.
4. **quatatrade-brand** — from Part 11: tokens, typography, do/don'ts, design QA list. Trigger: any UI work.
5. **quatatrade-api-contract** — from §07/§09: shared-zod-schema discipline, typed client usage, contract tests. Trigger: new/changed endpoints.

Each: `name` + sharp `description` (triggering), SKILL.md under ~300 lines linking to the full doc in `/docs`, and explicit constraints ("NEVER use number for amounts", "NEVER update trades.status directly").

## 12.5 Hard rules for this repo
- Signer host: no Claude Code, no plugins, no MCP. Human-written code only.
- Any new skill/plugin: read its SKILL.md and scripts before install; project-level install; note it in the Deviations Log if it affects workflow.
- Skills advise; the docs decide. On conflict between a community skill and Parts 01–11, the docs win.
- MCP DB access: dev database, read-only role, never credentials that can touch real funds or user data.

## 12.6 Setup status (implemented 2026-07-02)

### ✅ Already in the repo (versioned, active on next session start)

| Item | Where |
|---|---|
| Custom skill **quatatrade-ledger** (§12.4 #1) | `.claude/skills/quatatrade-ledger/SKILL.md` |
| Custom skill **quatatrade-escrow-fsm** (§12.4 #2) | `.claude/skills/quatatrade-escrow-fsm/SKILL.md` |
| Custom skill **quatatrade-security-gates** (§12.4 #3) | `.claude/skills/quatatrade-security-gates/SKILL.md` |
| Custom skill **quatatrade-brand** (§12.4 #4) | `.claude/skills/quatatrade-brand/SKILL.md` |
| Custom skill **quatatrade-api-contract** (§12.4 #5) | `.claude/skills/quatatrade-api-contract/SKILL.md` |
| MCP: Postgres (dev, read-only) + Context7 + Playwright (§12.3) | `.mcp.json` — approve servers on first session prompt |
| Read-only DB role `quatatrade_readonly` (SELECT only) | migration `backend/src/db/migrations/0007_readonly_role.ts` |
| Tier-1 official plugins pre-enabled (§12.1) | `.claude/settings.json` `enabledPlugins` |
| Karpathy behavioral rules merged (§12.2) | `CLAUDE.md` → "Behavioral hard rules" |
| `.env` files denied to Claude reads | `.claude/settings.json` `permissions.deny` |

### 🔲 One-time interactive steps (run yourself — cannot be automated from a session)

```text
# Official marketplace plugins (if the settings.json pre-enable prompts, accept):
/plugin install security-guidance@claude-plugins-official
/plugin install pr-review-toolkit@claude-plugins-official
/plugin install commit-commands@claude-plugins-official
/plugin install claude-md-management@claude-plugins-official
/plugin            → Discover → playwright, typescript (code intelligence)

# GitHub MCP (needs your fine-grained PAT, this repo only):
claude mcp add github --scope project -- npx -y @modelcontextprotocol/server-github
#   then set GITHUB_PERSONAL_ACCESS_TOKEN in your shell profile — never in the repo.

# Community skills — READ each SKILL.md before copying (rule zero):
#   obra/superpowers, trailofbits skills, owasp-security, webapp-testing
#   → clone, review, copy chosen folders into .claude/skills/
#   Karpathy rules are already merged into CLAUDE.md — no install needed.
```

### Security posture applied
- Postgres MCP uses the `quatatrade_readonly` role (SELECT only) against `localhost` dev; password overridable via `QT_MCP_DB_PASSWORD` env — never point it at staging/prod.
- No community skill was auto-installed: §12.5 requires human review of third-party SKILL.md files before they execute in a money-codebase environment.
- Telemetry postinstall (`@scarf/scarf`) and fallback-native builds are denied in `pnpm-workspace.yaml` `allowBuilds`.
