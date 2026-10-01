# adoa

Azure DevOps agent pipeline. Design notes: personal docs vault `D:/Claude/personal-projects/adoa` (entry `adoa-index`).

## Status
- Phase 1: Docker Compose + Postgres schema.
- Phase 2: ADO sync into the Vault, web UI (Backlog, Settings).

## Run
```bash
cp .env.example .env      # fill in passwords, paths, ADO_PAT, seed values
docker volume create adoa_pgdata   # first time only; external, so `compose down -v` can't delete it
docker compose up -d --build
```
- Web UI: http://localhost:3100 (`WEB_PORT`).
- DB on `127.0.0.1:${DB_PORT}` (default 5442; 5432 is often taken by a local Postgres).
- ADO org/project/team/user live in the DB and are edited in Settings; `ADOA_SEED_*` only fill them on first start.

## Backups
- `backup` service: one `pg_dump` at start, then daily at `BACKUP_CRON` (UTC) into `BACKUP_PATH` (default `./backups`); keeps `BACKUP_KEEP_DAYS` (14).
- Restore: `docker compose stop worker web`, then `docker compose run --rm backup sh /scripts/restore.sh /backups/<file>.dump`, then `docker compose start worker web`.

## Layout
| Path | Role |
|---|---|
| `packages/db` | Drizzle schema, migrations, `migrate` script |
| `packages/core` | settings, queues (pg-boss), status history, runs |
| `packages/ado` | read-only Azure DevOps REST client |
| `packages/vault` | note rendering; keeps each note's `## Notes` section |
| `apps/worker` | pg-boss worker: scheduled `sync` job |
| `apps/web` | Next.js UI |

## Local development
```bash
npm install
npm run dev:web                                                  # needs DATABASE_URL, ADO_PAT in env
node --env-file=.env --import tsx apps/worker/src/syncOnce.ts   # one sync; needs DATABASE_URL
```

## Schema changes
1. Edit `packages/db/src/schema.ts`.
2. `cd packages/db && npx drizzle-kit generate --name <change>`
3. `docker compose up -d --build`

## Notes
- The image sets `NODE_OPTIONS=--no-network-family-autoselection`: Node's connection racing times out on this Docker network (npm ETIMEDOUT).
- Only `migrate` builds the `adoa-app` image; `worker` and `web` reuse it.
