---
name: dev-local-run
description: Configure PVS.Internal, PVS or VAPI services for a local run on this machine with the DevSecrets tool (D:/Projects/AgentTools/DevSecrets, values in D:/Projects/dev-secrets). Writes the services' .NET user secrets and routes their calls to the other services run locally (key "dev") and to remote Azure dev instances for everything else. Use when the user asks to configure/prepare/set up a project or service (Signals, Patients, Verifications, BFF, Mappings, Configuration, PVS portal/API/internal API/background, VAPI) for local run or debugging, to run several services locally together, to point one service at a local or remote instance of another, to switch to local or remote infrastructure, or to add a secret, key, project or service to the store.
---

# Configure a local run

Tool: `D:/Projects/AgentTools/DevSecrets` (scripts, `services.json`, `map.json`, patches, `README.md`; in the AgentTools git repo, no secrets).
Values: `D:/Projects/dev-secrets/values.*.json` (outside git; never copy them into AgentTools). Read the tool's `README.md` when something here is not enough.
Never print, copy into chat or commit a secret value. Show key names, value names, hosts only.

## 1. Translate the request into services

| Service | What runs | Local URL |
|---|---|---|
| `signals` | Signals AppHost (ApiService + Deno runner) | https://localhost:7456 |
| `patients` | Patients AppHost / Patients.App | https://localhost:7058 |
| `verifications` | Verifications ApiService | https://localhost:7561 |
| `bff` | BFF.Aggregators.Api | https://localhost:7107 |
| `mappings` | Mappings AppHost | https://localhost:7021 |
| `configuration` | PVS.Internal.Configuration | https://localhost:7213 |
| `pvs-web` | PVS.Clients.WebClient.Core (portal; `Program.cs` hard-codes the port) | http://localhost:5001 |
| `pvs-api` | PVS.API.Core | http://localhost:9977 |
| `pvs-internal-api` | PVS.Internal.API.Core | https://localhost:7266 |
| `pvs-background` | PVS.BackgroundServiceHostCore (jobs, saga) | – |
| `pvs-transaction-consumer`, `pvs-failed-transaction-consumer`, `pvs-patient-processing-consumer`, `pvs-verification-delta-consumer`, `pvs-failed-verification-delta-consumer`, `pvs-scheduler` | one PVS consumer each | – |
| `rabbitmq` | local RabbitMQ container (added automatically for consumers) | rabbitmq://localhost:5673/pvs-local |
| `vapi` | VAPI.Api (+ X12Transfer) | http://localhost:15788 |

`services.json` is the source of truth; re-read it if the table seems out of date.

- "Configure Signals for a local run" → `-Local signals` (all dependencies remote).
- "Run Signals and Verifications locally" → `-Local signals,verifications` (Signals calls the local Verifications API).
- "Portal against my local Signals" → `-Local pvs-web,signals`.
- "Use local database/storage/bus" → add `-Values local`; check that `values.local.json` has the overrides, else ask for them.
- A service name you can't map → ask; don't guess.

## 2. Run

```powershell
D:/Projects/AgentTools/DevSecrets/Use-DevSecrets.ps1 -Local <services> -DryRun
D:/Projects/AgentTools/DevSecrets/Use-DevSecrets.ps1 -Local <services>
```

Dry-run first and show the `[calls: …=local|remote]` lines. Run the real write without asking when the request was clear; it only touches the listed services' user secrets and keeps a `secrets.json.bak`.
If the script reports problems, it wrote nothing: fix the store (step 4) or tell the user which value is missing.

### Run the services, not only configure them

When the services must actually run (a test, a check, "start X and Y"):

```powershell
D:/Projects/AgentTools/DevSecrets/Start-LocalStack.ps1 -Services <services> [-Branch <branch>]
D:/Projects/AgentTools/DevSecrets/Get-LocalStack.ps1 -Json
D:/Projects/AgentTools/DevSecrets/Stop-LocalStack.ps1
```

It returns when every service is ready (or stops everything and prints the failing logs). Config goes in as environment variables, so this does not touch user secrets; the patches, Deno cache and worktree are handled. Always stop the stack when done. PVS services need the VPN. Read the README's "Start a local stack" before changing this.

## 3. Finish

Tell the user, in a few lines:
- which services were configured and where each of their calls goes (local URL or remote);
- to start every local service, each on the URL from the table, and to restart anything already running;
- for `signals` on Windows: `DENO_TLS_CA_STORE=system` must be set as a user environment variable (they set it, you don't) and the runner patch must be applied in that checkout: `D:/Projects/AgentTools/DevSecrets/Use-LocalPatches.ps1 -Repo <checkout>` (run it for a new worktree; without `-Repo` it uses the current directory's checkout).
- for `signals` in a checkout or worktree: the Deno dependency cache (`DenoScripts/vendor`, git-ignored) must be complete, because the runner starts Deno with `--cached-only`. Check `vendor/jsr.io/@std` has `log`; if not, run `deno install --frozen --entrypoint main.ts` in `Signals/src/PVS.Signals.Runner.Deno/DenoScripts` (downloads the locked packages from jsr.io). Symptom: "JSR package manifest for '@std/log' failed to load … --cached-only is specified".
- for `signals` in a fresh worktree: run `dotnet build Signals/src/PVS.Signals.AppHost/PVS.Signals.AppHost.csproj` once from the command line (restores and builds). Visual Studio can't restore `Signals/libs/PVS.IntegrationEvents.*` there or build `Signals/libs/PVS.IntegrationEvents.*` there because the solutions don't include those projects (NU1105 "Unable to find project information", then CS0006 "Metadata file … could not be found").
- User secrets load only with environment `Development`; profiles like `Azure.Development` or `DevAzure` don't see them.

## 4. Change the store

- New secret: add the value to `D:/Projects/dev-secrets/values.remote.json`, then `"<config key>": "<value name>"` under the project in `map.json`.
- New call to another service: map its URL and key settings to `@<service>.url|<remote value>` and `@<service>.key|<remote value>`; add the remote URL as a named value.
- New project: needs a `UserSecretsId` (in the project, else add a conditional block to `D:/Projects/Directory.Build.props`; never edit the tracked `.csproj` for this), an entry in `map.json` (`<repo>/<path to csproj>`) and in the service's `projects` in `services.json`.
- New service: add it to `services.json` with `localUrl`, `localKey` (`dev` when its launch settings or AppHost use that) and `projects`.
- Edit the JSON with a script that validates every reference before writing, then run `-DryRun -All` to check.
