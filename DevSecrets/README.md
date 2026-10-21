# DevSecrets

Local configuration for running PVS.Internal, PVS and VAPI services on this machine.

This folder (in the AgentTools repo) holds no secrets. The values live outside git in `D:/Projects/dev-secrets` (override with `DEV_SECRETS_VALUES_DIR`); `.gitignore` here blocks `values.*.json`.

| File | What it holds |
|---|---|
| `services.json` | Runnable services: their projects, how to run them (`run`), whether they consume the bus (`consumesBus`). No links: those are values. |
| `map.json` | Repos, and per project: config key → value name, or a call to an app (`@patients.url`). |
| `D:/Projects/dev-secrets/values.<environment>.json` | One file per **environment** (user decision 2026-10-14): `values.dev.json` (Azure dev: connection strings, keys, every app's links `<app>-url`, `-key`, `-user`, `-connection`), `values.local.json` (`"$extends": "dev"`; every app's local links, e.g. `patients-url = https://localhost:7058`, plus local infrastructure overrides). `values.stage.json` later. |
| `Use-DevSecrets.ps1` | Writes the secrets and routing of the services you run locally into their .NET user secrets. |
| `Use-LocalPatches.ps1` + `patches/` | Local-only code fixes, applied and hidden from git. |
| `Start-LocalStack.ps1`, `Get-LocalStack.ps1`, `Stop-LocalStack.ps1` | Start a chain of local services pointed at each other (config as environment variables), show it, stop it. |
| `rabbitmq/` | Local RabbitMQ container (compose, definitions) for stacks with bus consumers. |
| `Start-DevHub.ps1` + `DevHub/` | DevHub: the configuration UI, and the HTTP API over the stack scripts for PowerLoom's agents in Docker. |
| `DevSecrets.*.ps1`, `LocalStack.*.ps1` | Helpers the scripts dot-source. |

## Configure a local run

```powershell
./Use-DevSecrets.ps1 -Local signals                        # Signals locally, all dependencies remote
./Use-DevSecrets.ps1 -Local signals,verifications          # Signals calls the local Verifications API
./Use-DevSecrets.ps1 -Local signals,patients,verifications # Signals calls local Patients and Verifications
./Use-DevSecrets.ps1 -Local pvs-web,signals                # portal calls the local Signals API
./Use-DevSecrets.ps1 -Local signals -DryRun                # check only
```

Then restart the AppHosts / services.

- `-Local` lists the services you run. Only their projects are written. Their calls to each other read the links of `values.local.json`; every other call and value comes from the environment (`-Values`, default `dev`).
- Services: `signals`, `patients`, `verifications`, `bff`, `mappings`, `configuration`, `pvs-web`, `pvs-api`, `pvs-internal-api`, `pvs-background` (jobs host), `pvs-transaction-consumer`, `pvs-failed-transaction-consumer`, `pvs-patient-processing-consumer`, `pvs-verification-delta-consumer`, `pvs-failed-verification-delta-consumer`, `pvs-scheduler`, `rabbitmq`, `vapi` (see `services.json` for URLs and projects).
- `-All` writes every project (with the same routing), `-Project "<repo>/<path pattern>"` a subset.
- `-Values <environment>` picks the environment for everything not run locally: `dev` (default), `local` (all local, falling back to dev for what it doesn't define).

## Start a local stack

```powershell
./Start-LocalStack.ps1 -Services pvs-web,pvs-background,pvs-transaction-consumer,signals
./Start-LocalStack.ps1 -Services pvs-web,signals -Branch feature/26885-Transactions-management-feature
./Start-LocalStack.ps1 -Services signals -Values local                  # everything else from values.local.json
./Get-LocalStack.ps1 [-Json]
./Stop-LocalStack.ps1
```

1. Checkouts: the main ones, or with `-Branch` the branch's worktree per repo (`<repo>-wt/<branch>`, reused or created; `-Repo pvs=<path>` overrides one).
2. Applies `patches/` to the used checkouts and installs the Deno cache when it is missing.
3. Resolves each service's configuration like `Use-DevSecrets.ps1` and passes it as **environment variables**: user secrets and other worktrees stay untouched.
4. A `usesCache` service adds `redis`: a local container (`localhost:6380`) that the stack's services cache in through `@redis.connection` (`redis-connection` of `values.local.json`), so a stack never shares cached settings and sessions with another environment (2026-10-20: a shared Redis served a settings dictionary without the password-expiry key, and the dev Azure Redis is unreachable from this PC). Services not in the stack keep the environment's `redis-connection`.
5. A `consumesBus` or `usesBus` service (consumers; the portal and the API publish) adds `rabbitmq`: a local container (`localhost:5673`, management `15673`, vhost `pvs-local`, guest/guest) instead of the dev broker, so local consumers never take dev messages. Its shovel forwards `cloud-events.fw.service-bus` to the Service Bus topic `<local-instance>-signals-integration-events`.
6. Builds the run projects one after another, starts each with `dotnet run --no-build --launch-profile <run.launchProfile>` in a hidden console, and waits (`-TimeoutSeconds`, default 300) until its local URL (`<app>-url` of `values.local.json`) answers, the log shows `run.readyLog`, or `run.readyProcess` runs. A service that exits or times out stops the whole stack and prints its last log lines.
7. A `configurable` service takes a per-stack configuration from `-Config '<json>'` (DevHub: the request's `config`). `pvs-background` (`workers`): its `workerConfigs.<Environment>.json` is written into the build output after the build with every worker off and the named ones on (`{"pvs-background": {"workers": {"ApiBatchProcessQueueWorker": {"RunAtStart": true, "Cron": "15"}}}}`), because the host reads those files after user secrets and environment variables; without `workers` the host runs no worker (on the shared database it would send dev's emails, reports and FTP downloads). The file goes with the stack; the next build restores the source. `Get-LocalStack.ps1` shows the workers in effect.

- One stack per machine: ports are fixed; start refuses while one runs or a port is taken.
- Logs (`<service>.log`, `.err.log`) and `stack.json` (PIDs) go to `D:/Projects/dev-secrets/stack` (`LOCAL_STACK_DIR`). Logs can hold secrets: don't paste them.
- Signals runs with `EventBus:EnvPrefix` = `local-instance` (`yhaidai`): its own topics `yhaidai-*` on the dev Service Bus, created by Wolverine at the first start (needs Manage rights). Dev Signals never sees them; data (Cosmos, storage) is the real dev data.
- PVS services need the dev network (VPN): they exit at startup when dev Redis/SQL are unreachable.

## Configuration UI

Open `http://127.0.0.1:47811/` while DevHub runs (`Start-DevHub.ps1`); sign in with the DevHub token (`dev-hub-token`, kept in that browser tab only).

| Tab | Shows |
|---|---|
| Apps | `services.json`: what each app starts, when it is ready, bus, projects; its local link and its links in dev (values; a name opens it in Secrets); add, edit, delete |
| Dependencies | who calls whom, and every project's settings from `map.json` (value name, or a call: the app's `<app>-<part>` link from the local file while it runs, else from the environment); add a project, add / edit / delete a setting |
| Secrets | every `values.*.json` value masked, with who reads it; Show / Copy reveal one value; add, replace, delete |
| Problems | `Use-DevSecrets.ps1 -All -Check` per values file (what a start would refuse), plus unused values and projects without an app |
| Stack | what runs (phase, owner, environment, apps with URLs, start output); start a chain of apps in an environment (optional branch, time limit), stop it, read an app's log (refresh every 5 s) |

Changes to apps and dependencies are made on a copy, checked by `Use-DevSecrets.ps1 -Check` on that copy (`DEV_SECRETS_STORE_DIR`) for every values file, and written only when they add no error; the files stay formatted as in git (apps and projects sorted, settings sorted case-insensitively). An app others call, or a project an app starts, can't be deleted. Secret changes:

- A delete is refused while a project or script reads the value (an override in `values.local.json` may go: the dev value takes over). `dev-hub-token` is read-only here.
- Every write first keeps the old file in `D:/Projects/dev-secrets/backups/` (the newest 20 per file); keys are written sorted.

`GET /config/apps|dependencies|secrets|problems`, `GET|PUT|DELETE /config/secrets/{file}/{name}`, `PUT|DELETE /config/apps/{name}`, `PUT /config/projects`, `DELETE /config/projects?project=`, `PUT /config/settings`, `DELETE /config/settings?project=&key=` (token required).

## DevHub (for PowerLoom)

```powershell
./Start-DevHub.ps1            # foreground; Ctrl+C stops DevHub and its stack
```

PowerLoom's agents run in Docker and cannot run these scripts; DevHub runs them on this machine.

| Call | Does |
|---|---|
| `GET /health` | no token |
| `GET /services` | runnable services from `services.json` |
| `POST /stack {services, branch?, ttlMinutes?}` | runs `Start-LocalStack.ps1` in the background (202); 409 while a stack runs |
| `GET /stack` | `phase` (idle, starting, ready, failed, stopping), services, last 200 lines of script output |
| `GET /stack/logs/{service}?lines=200&error=false` | tail of the service's log |
| `DELETE /stack` | runs `Stop-LocalStack.ps1` (also kills a start in progress) |
| `POST /browser {owner, case, headless?}` | starts one Playwright MCP (`@playwright/mcp`, pinned in `DevHub/playwright-mcp`) for the case, headless or in a window, recording into `<stack>/browser/<owner>/<case>/`; 409 while a case is open |
| `GET /browser` | the open case: owner, case, headless, when it closes by itself |
| `/browser/mcp` | the case's MCP (streamable HTTP) behind DevHub's token: the agent's MCP client talks to it directly; DevHub keeps the session for its own calls |
| `POST /browser/type-secret {element, target, valueName, submit?}` | DevHub types a dev-secrets value into the snapshot element `target`, so an agent never sees it; the answer is redacted |
| `DELETE /browser?owner=` | stops the video and the trace, closes the browser, zips the trace to `trace.zip`, kills the MCP; answers with the files |
| `GET /browser/artifacts?owner=` | an owner's recordings |

- Listens on `127.0.0.1:47811` only; containers call `http://host.docker.internal:47811`.
- `Authorization: Bearer <token>`: the dev-secrets value `dev-hub-token`, created on the first run.
- A stack stops when `ttlMinutes` (default 60, max 240) runs out, and when DevHub stops.
- Logs and start output can hold secrets; whoever holds the token can read them.
- `POST /stack` takes an `owner` (PowerLoom: `powerloom-run-<id>`); `DELETE /stack?owner=` stops only that owner's or an unclaimed stack. Without `owner` (a person) it stops any.
- PowerLoom: Settings → DevHub (URL, token, Test DevHub, Open DevHub) per vault, and the agent switch "DevHub (run services)"; the runner stops a run's stack when the run ends.
- `GET /browser/artifacts/owners` lists every owner's recordings folder (size, newest write); `DELETE /browser/artifacts/{owner}?dryRun=` removes one (a dry run only measures it; refused while that owner's case is open). PowerLoom's daily artefact cleanup calls both for runs past their buffer.
- Browser cases: one at a time, like the stack; the owner's `DELETE /browser` closes it, a person's (no owner) closes any; an idle case closes after `DevHub:BrowserIdleMinutes` (30) and when DevHub stops. The MCP gets every dev-secrets value as its `--secrets` file, so a value that shows up in a page or a typed field is redacted in the tool answers. `Start-DevHub.ps1 -Browser msedge|chrome|chromium` picks the browser (default: the installed Edge); the script installs the MCP (`npm install`) and Playwright's ffmpeg (video) on the first start. The runner's `browser_*` tools come with the DevHub switch; the runner closes a run's case when the run ends.

## Stale artefacts on this PC (Remove-StaleArtefacts.ps1)

PowerLoom's cleanup job runs inside Docker and cannot reach these; the script does, with the same buffers:

| Store | Goes when |
|---|---|
| `<stack>/*.log` (service logs, can hold secrets) | the stack is stopped and the file is older than `-LogDays` (7) |
| `PowerLoom/tools/audio-capture/home/recordings/<session>/*.wav` | the session was imported (its transcript exists, its inbox file is gone) `-RecordingDays` (7) ago; a session never handed over, after `-UntouchedRecordingDays` (30); transcripts and `models/` stay |
| `D:/Projects/<repo>-wt/<branch>` worktrees | clean, pushed with nothing ahead, and the branch's PBI (`<type>/<id>-…`) closed or done ≥ `-WorktreeClosedDays` (14) in the backlog vault; dirty, local-only or no-PBI worktrees and `.claude/worktrees/*` are only listed |
| `%LOCALAPPDATA%/Temp/claude/*` (Claude Code scratch) | nothing in the folder was written for `-ScratchDays` (7) |

```powershell
./Remove-StaleArtefacts.ps1 -DryRun     # lists what would go, with sizes; nothing is removed
./Remove-StaleArtefacts.ps1             # removes it
```

Register it as a daily Windows scheduled task (run as your user, so git and the worktrees are yours):

```powershell
$action = New-ScheduledTaskAction -Execute "pwsh.exe" -Argument "-NoProfile -File D:\Projects\AgentTools\DevSecrets\Remove-StaleArtefacts.ps1"
$trigger = New-ScheduledTaskTrigger -Daily -At 03:30
Register-ScheduledTask -TaskName "PowerLoom stale artefacts" -Action $action -Trigger $trigger -Description "Removes stale local stack logs, meeting audio, closed-PBI worktrees and Claude scratch folders"
```

Selection rules live in `StaleArtefacts.Selection.ps1` (tests: `Tests/StaleArtefacts.Tests.ps1`, Pester).

## Routing references (map.json)

A call names the app and the part; the value is the app's link in an environment file:

| Reference | Reads | From |
|---|---|---|
| `@patients.url` | `patients-url` | `values.local.json` when patients runs in the stack (`-Local`), else the environment (`values.dev.json`) |
| `@vapi.url-2` | `vapi-url-2` | the same; `-2` is an app's second address (VAPI has two instances) |
| `@patients.key` in a Patients project | `patients-key` | always `values.local.json`: a project's own app is local (its inbound key, e.g. the AppHost `parameters:api-key`) |

Local inbound keys: Signals, Verifications and BFF read `ApiKey=dev` from their `launchSettings.json`; Patients and Mappings get theirs from the AppHost `parameters:api-key` (`patients-key`, `mappings-key` in `values.local.json`).

## Where things are stored

- User secrets: `%APPDATA%/Microsoft/UserSecrets/<UserSecretsId>/secrets.json`. Shared by every worktree of a project. Loaded only when the environment is `Development`, and overridden by environment variables (e.g. `launchSettings.json`).
- Each run overwrites the mapped keys and keeps the others (e.g. Aspire's). The first run saves `secrets.json.bak`.
- The script validates every selected project and value first and writes nothing if anything is missing.

## Add a value, key, project or service

- New secret: add the value to `values.dev.json` (and to `values.local.json` when it differs locally) and `"<config key>": "<value name>"` under the project in `map.json` (`:` for nesting).
- New call to another service: map the URL and key settings to `@<service>.url` and `@<service>.key`; the app's links `<service>-url` / `-key` must exist in `values.local.json` and in every environment.
- New project: give it a `UserSecretsId` (in the project or in `D:/Projects/Directory.Build.props`), add it to `map.json` and to its service's `projects` in `services.json`.
- New runnable service: add its local link `<service>-url` to `values.local.json`, and in `services.json` add `run` (`project`, `launchProfile`, and `readyLog` or `readyProcess` when it has no URL) and `consumesBus: true` when it consumes RabbitMQ.
- Local infrastructure: override in `values.local.json`. Change together: `signals-storage` and `signals-blob-host` (Deno runner allowed host; `127.0.0.1` for Azurite).

## Other local-only settings

| What | Where | Note |
|---|---|---|
| `UserSecretsId` for projects that have none; `TypeScriptCompileBlocked` for Signals.Runner.Deno | `D:/Projects/Directory.Build.props` | MSBuild imports it for every project under `D:/Projects` (incl. worktrees) unless a repo adds its own `Directory.Build.props`. |
| `DENO_TLS_CA_STORE=system` | User environment variable (`setx DENO_TLS_CA_STORE system`) | Lets the local Deno runner trust the ASP.NET dev certificate. |
| Code fixes | `patches/*.patch`, `Use-LocalPatches.ps1` | See below. |
| Restore and build of `Signals/libs/PVS.IntegrationEvents.*` | Each fresh worktree | Not in the solutions, so Visual Studio neither restores (NU1105) nor builds (CS0006) them. Run `dotnet build Signals/src/PVS.Signals.AppHost/PVS.Signals.AppHost.csproj` once. |
| Deno dependency cache (`DenoScripts/vendor`, git-ignored) | Each checkout / worktree | The runner uses `--cached-only`. In a new worktree run `deno install --frozen --entrypoint main.ts` in `Signals/src/PVS.Signals.Runner.Deno/DenoScripts`. |

## Local code patches

```powershell
Use-LocalPatches                                                  # current checkout: apply (if needed) and hide from git
./Use-LocalPatches.ps1 -Repo D:/Projects/PVS.Internal            # a given checkout
./Use-LocalPatches.ps1 -Repo D:/Projects/PVS.Internal -Release   # before pull / branch switch touching those files
```

- A patch applies only to the checkout that has all its files; others are skipped.
- `runner-allow-net-authority.patch`: the runner passes `host:port`, not a URL, to Deno's `--allow-net` (needed on Windows, where the runner uses HTTP instead of Unix sockets).
- Patched files are marked `skip-worktree`: `git status` and `git add .` ignore them. The mark is per checkout, so run the script in each new worktree.
- If a pull or checkout says the file "would be overwritten", run with `-Release`, discard the file, pull, then run again.

## Agent skill

`skills/dev-local-run/SKILL.md` teaches agents to use this tool ("configure Signals for a local run", "Signals and Verifications locally").

- Claude Code: `C:/Users/gayda/.claude/skills/dev-local-run` is a junction to this folder, so edits here apply directly.
- adoa: `Adoa/docker-compose.yml` mounts `../DevSecrets/skills` read-only as `/app/DevSecrets/skills` and lists it in `SKILL_FOLDERS` (agent-runner and web).
