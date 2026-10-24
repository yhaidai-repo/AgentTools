# PowerLoom

Azure DevOps agent pipeline: a .NET backend (Wolverine, Postgres) that syncs PBIs, runs the pipeline and dispatches the
agents, a TypeScript agent runner and a Next.js web UI. Design and status: the `adoa` folder of the personal docs vault
(`D:/Claude/personal-projects/adoa`, entry `adoa-index`; the backend's notes are `adoa-wolverine-target`,
`adoa-backend-endpoints`, `adoa-backend-delivery`). The project was called adoa until 2026-10-11.

## Layout
| Path | Role |
|---|---|
| `src/PowerLoom.Api` | the executable: `Program.cs` only |
| `src/PowerLoom.Core` | features (vertical slices) and infrastructure; `[assembly: WolverineModule]`, `[assembly: JasperFxAssembly]` |
| `src/PowerLoom.Domain` | the pipeline's rules over the persistence model |
| `src/PowerLoom.Persistence` | EF Core model of the `public` schema (entities, one configuration per table, enums), migrations |
| `src/PowerLoom.Contracts` | messages and types shared across projects |
| `src/PowerLoom.AdoIntegration`, `src/PowerLoom.ConfluenceIntegration` | the Azure DevOps and Confluence libraries |
| `tests/PowerLoom.Api.Tests` | Alba + Testcontainers (one host and Postgres per run) |
| `apps/agent-runner` | runs one agent task at a time on `POST /runs` from the backend (which dispatches on the agents' schedules and Run now) and reports each run back; the Claude token from Settings → AI providers (`.env`'s `CLAUDE_CODE_OAUTH_TOKEN` as the fallback) and Codex's login in `agent-homes/codex` (mounted at `/codex-home`); skills read-only, docs vault writable for the tech-writer's merges |
| `apps/web` | Next.js UI (Backlog, PBI pages, Tasks, Agents, Settings, Vault) |
| `packages/*` | the TypeScript libraries the two apps share (`db`, `core`, `agents`, `notes`, `ado`, `confluence`, `attachments`, `vault`) |
| `skills/` | PowerLoom's own skills for agents (`powerloom-*`) |
| `templates/vault` | root files of a new vault (Settings → Add vault) |
| `tools/outlook-export` | the Outlook mail export for the `outlook` import source |
| `scripts/` | backup and restore, schema tooling |

The npm workspace root is the repository root (`AgentTools`) (with `AgentConfig`, `AgentRuntime`, `AgentUsage`); `Dockerfile.apps`
builds the TypeScript image from there, `Dockerfile` the backend from this folder.

## Run
First installation on a Windows PC with Docker Desktop: `pwsh scripts/install.ps1 -Vaults <vault path>,…` (full paths in one parent folder; optional `-ReposRoot`, `-SkillsPath`) (`.env`, folders,
database volume, stack, vaults with their vault review schedule; safe to run again). Its last step,
`scripts/Set-AiProviders.ps1`, optionally sets the AI providers through the API: the Claude token, Connect Codex, the
chat app (`-ClaudeToken`, `-ConnectCodex`, `-ChatApp`, `-SkipProviders`; run it alone any time; a connected provider is
left as it is). By hand:
```bash
cp .env.example .env               # passwords, paths (the Claude token goes in Settings → AI providers)
docker volume create adoa_pgdata   # first time only; external, so `compose down -v` can't delete it (the name predates the rename)
docker compose up -d --build
```
- Web UI: http://localhost:3100 (`WEB_PORT`); backend: http://127.0.0.1:5180 (`POWERLOOM_PORT`, `/health`, `/openapi/v1.json`); Grafana: `GRAFANA_PORT`.
- DB on `127.0.0.1:${DB_PORT}` (default 5442). ADO org/project/team/user and tokens live in the DB, per vault (Settings).
- Settings → AI providers, one for the whole PowerLoom (global `config` rows): the Claude token (`claudeToken`; without it
  the agent-runner uses `CLAUDE_CODE_OAUTH_TOKEN` from `.env` and reports that at start-up as `claudeEnvToken`) and the
  chat app "Continue with …" opens (`chatApp`; else `CONTINUE_LAUNCHER`, else Claude). An agent whose provider isn't
  connected is blocked at once with "Connect <provider> in Settings → AI providers"; the Agents page offers only
  connected providers' models.
- Codex (provider `openai-codex`, the ChatGPT plan): **Connect Codex** in Settings → AI providers has the agent-runner run
  `codex login --device-auth` in `PowerLoom/agent-homes/codex` (git-ignored, created by the install script, mounted at
  `/codex-home`; never your `~/.codex`) and shows the link and code. Switch on "Device code authorization" in ChatGPT →
  Settings → Security first. Fallback: upload an `auth.json` from a PC where `codex login` worked. Disconnect removes the
  login. Codex is connected while that file is there. Its built-in tools can't all be switched off: runs use a read-only
  sandbox and the trace shows every built-in step. The chat app can be Codex once it is connected; each vault gets both
  MCP entries (`.mcp.json` for Claude Code, `.codex/config.toml` for Codex), and "Configure with Codex" also copies
  `~/.claude/CLAUDE.md` into `~/.codex/AGENTS.md` and `~/.claude/skills` into `~/.agents/skills`, asking before
  overwriting.
- Rebuild only after checking `agent_run` for a run without `ended_at`.

## Backups
- `backup` service: one `pg_dump` at start, then daily at `BACKUP_CRON` (UTC) into `BACKUP_PATH` (default `./backups`); keeps `BACKUP_KEEP_DAYS` (14).
- Restore: `docker compose stop powerloom agent-runner web`, then `docker compose run --rm backup sh /scripts/restore.sh /backups/<file>.dump`, then `docker compose start powerloom agent-runner web`.

## Backend commands (`dotnet run --project src/PowerLoom.Api -- <command>`)
| Command | Does |
|---|---|
| `describe` | Wolverine's endpoints, queues and handlers |
| `codegen write` | writes Wolverine's handler code to `src/PowerLoom.Api/Internal/Generated` (the Docker build does this; no database needed) |
| `openapi-write ../../openapi/PowerLoom.Api.json` | writes the OpenAPI document; then `npm run openapi -w @powerloom/web` regenerates the web's typed client |

Settings come from the environment (they override `appsettings.Development.json`): `ConnectionStrings__PowerLoom`,
`Vaults__Root`, optionally `OTEL_EXPORTER_OTLP_ENDPOINT`. Run locally with `dotnet run --project src/PowerLoom.Api`.

## Schema
The backend owns the `public` schema through EF Core migrations, applied at start (`DatabaseMigrator`); drizzle's
`packages/db/drizzle` is frozen history.

```bash
dotnet tool run dotnet-ef migrations add <Name> --project src/PowerLoom.Persistence --startup-project src/PowerLoom.Persistence --output-dir Migrations
```

To check a migration against a live database, apply the migrations to a scratch database and diff
`pg_dump --schema-only -n public` of both through `scripts/normalize-schema-dump.py`.

## PBI import
The PBI sync (Settings import schedule, default every 5 min, or **Import now** on the Backlog) reads every import source
(`src/PowerLoom.Core/Features/ImportSources`), syncs the PBIs each item links and prepares the new ones. Both sources read
folders under `IMPORT_INBOX_PATH` (default `./import-inbox`); read files are deleted, unusable ones move to `failed/` with a
`.reason.txt`. Write `<name>.json.tmp`, then rename to `.json`.
- `outlook`: `import-inbox/outlook/*.json`, mails written by `tools/outlook-export` (classic Outlook, Inbox by subject).
- `inbox`: `import-inbox/*.json`, a ready request from any tool: `source`, `sourceRef`, optional `title`, `from`, `occurredAt`, and `adoIds` and/or `html` / `text` with ADO work item links; `prepare` defaults to true.

## Local development
```bash
npm install                        # in the repository root
npm run powerloom:dev:web          # needs DATABASE_URL, POWERLOOM_URL in env
```

## Notes
- The TypeScript image sets `NODE_OPTIONS=--no-network-family-autoselection`: Node's connection racing times out on this Docker network (npm ETIMEDOUT).
- Only `agent-runner` builds the `powerloom-app` image; `web` reuses it.
- The PBI notes' region markers (`<!-- adoa:begin … -->`) keep their name: they are the file format of every rendered note.
