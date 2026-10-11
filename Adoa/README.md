# adoa

Azure DevOps agent pipeline. Design notes: personal docs vault `D:/Claude/personal-projects/adoa` (entry `adoa-index`).

## Status
- Phase 1: Docker Compose + Postgres schema.
- Phase 2: ADO sync (DB), manual "Prepare for refinement" into the Vault, web UI (Backlog, Settings).
- Phase 3: refinement agent in `agent-runner` (AgentRuntime + AgentUsage from `../AgentRuntime`, `../AgentUsage`), Agents page with metrics, runs and traces.

## Run
```bash
cp .env.example .env      # fill in passwords, paths, ADO_PAT, CLAUDE_CODE_OAUTH_TOKEN, seed values
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
| `packages/agents` | prompts (`prompts/*.md`, versioned), `runAgent`, refinement agent |
| `apps/worker` | no jobs left (every job runs in PowerLoom); keeps pg-boss's maintenance until phase 6 removes both |
| `apps/agent-runner` | runs one agent task at a time on `POST /runs` from PowerLoom (which dispatches on the agents' schedules and Run now) and reports each run back; Claude token; skills read-only, docs vault writable for the tech-writer's merges |
| `skills/` | adoa's own skills for agents |
| `apps/web` | Next.js UI |

Workspace root is `D:/Projects/AgentTools` (npm workspaces incl. `AgentRuntime`, `AgentUsage`); Docker builds from there.

## Local development
```bash
npm install                                                      # in D:/Projects/AgentTools
npm run dev:web                                                  # needs DATABASE_URL, ADO_PAT in env
```

## PBI import
PowerLoom's PBI sync (Settings import schedule, default every 5 min, or **Import now** on the Backlog) reads every import source (`PowerLoom/src/PowerLoom.Core/Features/ImportSources`), syncs the PBIs each item links and prepares the new ones. Both sources read folders under `IMPORT_INBOX_PATH` (default `./import-inbox`); read files are deleted, unusable ones move to `failed/` with a `.reason.txt`. Write `<name>.json.tmp`, then rename to `.json`.
- `outlook`: `import-inbox/outlook/*.json`, mails written by `tools/outlook-export` (classic Outlook, Inbox by subject).
- `inbox`: `import-inbox/*.json`, a ready request from any tool: `source`, `sourceRef`, optional `title`, `from`, `occurredAt`, and `adoIds` and/or `html` / `text` with ADO work item links; `prepare` defaults to true.

## Schema changes
1. Edit `packages/db/src/schema.ts`.
2. `cd packages/db && npx drizzle-kit generate --name <change>`
3. `docker compose up -d --build`

## Notes
- The image sets `NODE_OPTIONS=--no-network-family-autoselection`: Node's connection racing times out on this Docker network (npm ETIMEDOUT).
- Only `migrate` builds the `adoa-app` image; `worker` and `web` reuse it.
