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
- Web UI: http://localhost:3100 (`WEB_PORT`); backend: http://127.0.0.1:5180 (`POWERLOOM_PORT`, `/health`, `/openapi/v1.json`).
- Local diagnostics: standalone Aspire Dashboard receives logs, metrics and traces through the existing OpenTelemetry
  exporter. Enable the `observability` profile and exporter in `.env` (see `.env.example`); UI: `TELEMETRY_PORT` (3200).
  The next `scripts/deploy-web.ps1` starts it (a deploy starts every enabled service that has no container).
  Its telemetry volume survives restarts, with limits of 10,000 logs, 5,000 traces and 1,000 metrics. It replaces the
  Prometheus rate charts; business charts and health checks use PowerLoom's own data.
- Dashboard → Application has native request-rate, average response-time and process-memory charts for the backend API.
  One-minute totals are kept in Postgres for 24 hours and displayed in five-minute intervals, even with telemetry export
  off. History survives API restarts; gaps mean no observations, latency is weighted by request count and memory is the
  highest sampled working set per interval. Collection starts on deployment, without historical backfill.
- MCP inspection: `performance_read` reads that native history (1–24 hours); `telemetry_logs`, `traces_list` and
  `trace_get` inspect Aspire through the backend's fixed internal address. All four are read-only and bounded;
  Aspire tools report disabled/unavailable explicitly and never start a container. `truncated` marks partial results,
  text/attributes are abbreviated, and time/text/duration filters apply to a bounded recent scan. Existing `logs_read`
  and `run_events` remain independent of Aspire. `TELEMETRY_API_KEY` optionally authenticates inspection of a secured
  external Aspire service; this stack's existing local-only anonymous diagnostics configuration is unchanged.
- Upgrade from `otel-lgtm` through `pwsh scripts/deploy-web.ps1 -WithApi`: the deploy replaces the old container on the
  same local port, preserves its historical `adoa_otel-data` volume and keeps old endpoint/port settings compatible.
  The viewer is switched before any app restart: if it fails, the old container is restored and the app rollout stops.
  The old history is not imported into Aspire.
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

## Continue in an existing chat
- **Continue with …** on a PBI, item or review offers **New chat** / **Existing chat**, with title/folder search and
  the current project's conversations first. Configure/import still start a new chat.
- Codex opens the selected conversation with the handoff prompt prefilled. Claude copies the prompt, shows
  “Prompt copied. Paste it into the selected Claude chat.”, then opens the selected local Code session.
  If copying fails, the prompt stays visible for manual copying or retry. No message is sent automatically.
- Choosing another chat preserves the item's existing handoff note; a missing note is created once.
- New installs discover desktop histories automatically. For an existing install, run
  `pwsh scripts/Set-DesktopChatHistory.ps1` from this folder before recreating the backend. It sets the three
  `*_DESKTOP_*_PATH` values in `.env`; existing custom paths are retained. Optional `-CodexHistory <home>` and
  `-ClaudeSessions <folder>` override discovery. The mounts are read-only and exclude login files.
- Catalog sources: Claude Desktop's `claude-code-sessions` metadata and Codex's active `sessions` headers plus
  `session_index.jsonl`. Archived and delegated conversations are excluded; user-created forks stay selectable.
  An app update that changes its metadata/link formats may need a reader update.

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

## Sandbox for coding runs
A run's builds and tests happen only in its sandbox (`apps/sandbox`): a container with no network, on a copy of the
run's worktree. The run's own shell refuses them, except that a build or test command it is given (the vault's
`repoCommands`, or one starting with `dotnet build|test|restore`, `npm test`, `npm run build|test`, alone or with `cd`
and output filters such as `| tail`) is run in the sandbox on a fresh sync of the worktree and comes back as that
command's result: exit code, output, and when the output was cut, its failed tests and compiler errors. So GSD's executor
and verifier sub-agents build and test with their plain Bash tool; the orchestrator also has `sandbox_sync` and
`run_command`. Packages come from the vault's package cache, a Docker volume `sandbox_restore` fills through the egress
proxy and every command reads offline (NuGet's only source is the cache, npm runs offline).

To prepare a host and a vault:
0. GSD itself: `npm install @opengsd/gsd-core@1.19.0` in a folder under `REPOS_ROOT` on the PC and set `GSD_CORE_DIR` in
   `.env` to that package's path as the agent-runner sees it (`/repos/...`); the runner refuses any other version.
1. Build the image: `docker build -t powerloom-sandbox - < Dockerfile.sandbox` (.NET SDKs 10 and 9 with runtime 8,
   Node 24, Deno, Python 3, PowerShell 7). It is the catalogue's `general` image (`sandbox-images.json`); a vault that
   needs other toolchains builds an image `FROM` it and adds an entry there.
2. `.env`: `sandbox` in `COMPOSE_PROFILES`, `SANDBOX_URL=http://sandbox:3300`, `SANDBOX_TOKEN` and `SANDBOX_PROXY_SECRET`
   (long random values), then `docker compose up -d`. Without the proxy secret every restore gets the fixed host list
   `SANDBOX_PACKAGE_HOSTS` instead of its vault's.
3. Settings → Data access → Sandbox: the image (empty = `general`) and the package hosts (default `api.nuget.org`,
   `registry.npmjs.org`). The vault's own Azure DevOps feeds are signed in with its Azure DevOps token and need no entry.
4. Private feeds of other organizations or with a token of their own: vault setting `vault:<vault>:packageFeeds` in the
   `config` table, `{"feeds": [{"url": "<feed URL, or a prefix covering several feeds>", "username": "<optional>",
   "token": "<PAT with Packaging (read)>"}]}`. A source of the repo's `nuget.config` (or `.npmrc`) under the URL gets the
   sign-in, during restores only; the feed's hosts (for Azure Artifacts also its blob storage) join the vault's package
   hosts. The token goes to the restore container as a NuGet credential variable, never into an image, a sandbox command
   or a log. Set it with SQL, e.g. `INSERT INTO config (key, value) VALUES ('vault:<vault>:packageFeeds', '{"feeds": [...]}')
   ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = now();`
5. Build and test commands: vault setting `vault:<vault>:repoCommands`, `{"repos": {"<repo>": {"build": "<command>",
   "test": "<command>"}}}`, the repo by its catalogue name (any case). The shell sends any of them (also with more
   arguments) to the sandbox, and the implementation agent's GSD gets its repo's as `workflow.build_command` and
   `workflow.test_command`; keep each a single command or `cd <folder> && <command>`, a compound isn't routed.
6. Agents page: switch on the agent's Sandbox integration.

The cache volume is `powerloom-packages-<vault>-<hash>` (label `powerloom.package-cache`); it outlives the sandboxes so
a vault's next run builds without fetching again, and restores into it take turns. Remove it with `docker volume rm` to
start the cache over. A package a repo doesn't reference yet is fetched with `sandbox_restore`'s `packages` (the restore
runs `dotnet add package`); `run_command` refuses `dotnet add package`, having no network.

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
- `apps/agent-runner/src/GsdWorktreePreparer.ts` prepares a per-PBI git worktree before the first GSD command (not wired into a run yet): creates `.planning/` (without it `gsd-tools.cjs` remaps to the main checkout), sets `commit_docs: false` in `.planning/config.json` (existing keys kept), appends `.planning/` and `.claude/` to the git exclude file, installs `@opengsd/gsd-core` 1.19.0 locally, and sets the run's commit identity with `git config --worktree`. The exclude file is `git rev-parse --git-path info/exclude`, which in a linked worktree is the main repo's `info/exclude`, shared by all its worktrees; `.gitignore` is never edited. The installer writes hooks and permissions to `.claude/settings.local.json`, so the run must use `settingSources: ["project", "local"]`.
- Hand-off (v1, 2026-10-28): every agent hands work on with `hand_off` (`packages/agents/src/handoff`): it creates the target item (agent task, human task, question), a `handoff` row (intent `continue` | `ask` | `review` | `return`, gate `approve` | `answer` | `none`, package body and refs) and the dependency. `create_task` only creates agent work nothing waits for. `packages/core/src/handoffs/renderHandoff.ts` renders the receiving agent's first block, the human task body and the Continue note's "Hand-off" section; `settleTask` ends a run by its hand-offs' intents; the dispatcher blocks a task whose gated dependency closed without `approve` (or without an answer) (`src/PowerLoom.Domain/Tasks/HandoffGates.cs`).
- Implementation (wave 3, 2026-10-29): the `implementation` agent takes `implement` tasks (`packages/agents/src/implementation`). It reads the plan review first: approve → GSD executes the plan on `powerloom/pbi-<id>` in the PBI's worktree (local commits only, no ship step); changes, corrected facts or a PBI changed since its plan (`planning_snapshot.pbi_content_hash`) → a `design` task with the changes; a cancelled review → blocked. The planning agent marks its implement task `data.readsReview`, so `HandoffGates` lets a review that asked for changes through to it. `write_implementation` stores `implementation_snapshot`; the hand-over human task gets the branch, the worktree and the pull request description, and the worktree is held with `git worktree lock` (reason names the task) until someone unlocks it. A task's `data.gsdModels` (`{"executor": "<model id>", "verifier": "<model id>"}`) sets its execution models; the default is Opus 5.5 for both.

## Demonstration
See [Demonstration agent](docs/support-guides.md) for local/remote tasks, screenshots, portable Confluence handoffs and rollout.
