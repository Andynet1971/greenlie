# Greenlie

**Your monitoring is green. Is it lying?**

[![CI](https://github.com/Andynet1971/greenlie/actions/workflows/ci.yml/badge.svg)](https://github.com/Andynet1971/greenlie/actions/workflows/ci.yml)

Uptime monitors ask "does it respond?". Greenlie also asks **"does it respond like
it usually does?"**. A service that answers `200 OK` with a tenth of its usual
content is not up — it's a silent failure, and it's exactly the kind of outage
that green dashboards miss.

## Live demo

**<https://greenlie.18-159-116-161.sslip.io>** — a public instance watching real
production services: two Atlassian Marketplace listings, a Chrome extension's
website, a blog, and an Apify scraper whose output volume is checked on every
run. It runs from the published images with `docker compose`, behind Caddy for
HTTPS, on a small AWS Lightsail server.

## Screenshots

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/overview-dark.png">
  <img src="docs/screenshots/overview-light.png" alt="Greenlie overview page: four checks, one of them Thin">
</picture>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/detail-dark.png">
  <img src="docs/screenshots/detail-light.png" alt="Check detail page: a volume chart dropping from 100 to 3, under a dashed threshold line">
</picture>

## How it decides

| Verdict   | When                                                                         |
| --------- | ----------------------------------------------------------------------------- |
| `ok`      | expected response, volume within the usual range                             |
| `down`    | network error, timeout, or an unexpected HTTP status                         |
| `slow`    | a correct response, but past the latency threshold                           |
| `thin` ⭐ | a **successful** response, with volume below a threshold of the median of the last N healthy runs |
| `stale`   | a scheduled job hasn't sent its heartbeat within its interval + grace period |
| `unknown` | too few measurements yet for a baseline — `thin` never fires on day one      |

⭐ **`thin` and `down` runs never enter the baseline.** Otherwise an outage that
lasts long enough would drag the "usual" volume down with it, until the outage
looked normal and the alarm turned itself off — the exact silent failure this
project exists to catch. The median is taken over the last N *healthy* runs
only, filtered in the database query itself so a long outage can't starve the
baseline into "still learning" and quietly suppress the alert.

Volume is measured as the length of the list at a JSON path (`$.items`, or
`$` if the response is already a list) — not the size of the response body.

## Quickstart

No account, no API key, no secret of any kind:

```bash
git clone https://github.com/Andynet1971/greenlie.git
cd greenlie
cp examples/quickstart.yml greenlie.config.yml
cp .env.example .env
docker compose up
```

Open <http://localhost:3000>. The quickstart config watches Greenlie's own
`/healthz` endpoint and its public commit history on GitHub — nothing external
to sign up for, nothing to break.

## Configuration

Checks live in a YAML file (`greenlie.config.yml`, gitignored — copy
[`greenlie.config.example.yml`](greenlie.config.example.yml) for the full
shape, with an HTTP check, a `json-volume` check, a heartbeat, and alerts).
`${VAR}` placeholders are substituted from the environment after the YAML is
parsed, so a secret with a colon or a newline in it can't corrupt the file.

Environment variables (see [`.env.example`](.env.example) for `docker compose`;
this is the full reference for running the pieces directly):

| Variable | Used by | Required | Default |
| --- | --- | --- | --- |
| `DATABASE_URL` | worker, web | yes | — |
| `GREENLIE_CONFIG` | worker, web | no | `greenlie.config.yml` |
| `SMTP_URL` | worker | only if `alerts.email` is set | — |
| `GREENLIE_RETENTION` | worker | no | `30d` |
| `POSTGRES_PASSWORD` | `docker-compose.yml` | yes | — |
| `QUICKSTART_PING_TOKEN` | `examples/quickstart.yml` | only with the quickstart config | — |

## Heartbeats

For scheduled jobs, not services with an endpoint of their own — a cron job
that reports in when it finishes:

```bash
curl -X POST https://your-greenlie-instance/ping/<token>
```

`GET` also works, for cron setups that only know how to hit a URL. No ping
within `every` + `grace` turns the check `stale`.

## Architecture

```
greenlie/
├─ packages/core     pure decision logic: verdicts, medians, thresholds — zero I/O
├─ packages/db       PostgreSQL + Drizzle: schema, migrations, the Store interface
├─ apps/worker       schedules checks, writes history, sends alerts on state changes
└─ apps/web          Next.js dashboard + the /ping and /healthz routes
```

| Choice | Why |
| --- | --- |
| TypeScript `strict` everywhere | no `any` escape hatches, `noUncheckedIndexedAccess` on |
| npm workspaces | one monorepo, no extra tooling to explain |
| PostgreSQL + Drizzle | schema-generated types, migrations checked into git |
| Vitest + Playwright | the core is unit-tested to 100%; the dashboard is covered end-to-end |
| Server-rendered SVG charts | zero client JavaScript, accessible (`role="img"`, a data table alongside every chart) |
| Postgres as a real service in CI | the test suite runs against PGlite *and* a real server — no database mock, ever |

## Development

```bash
npm install
npm run check       # typecheck + lint + test, with a coverage threshold
npm run e2e          # Playwright, against a throwaway in-memory database
```

No Docker needed for any of this: [PGlite](https://pglite.dev/) runs a real
Postgres, compiled to WebAssembly, inside the test process. To test against an
actual Postgres wire-protocol server instead:

```bash
npx pglite-server --port 5433 --max-connections 10
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5433/postgres npm run migrate
TEST_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5433/postgres npm test
```

## Limitations, on purpose

This is a first version, and every one of these doubles the project:

- No users, no login, no multi-tenancy.
- The dashboard is **read-only** — checks are configuration, not database rows.
- No integration-specific alerts (Slack, PagerDuty…): a generic webhook covers them.
- Volume is a list's length, not a byte count.

## License

[MIT](LICENSE)
