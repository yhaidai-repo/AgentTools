# DevSecrets

Local configuration for running PVS.Internal, PVS and VAPI services on this machine.

This folder (in the AgentTools repo) holds no secrets. The values live outside git in `D:/Projects/dev-secrets` (override with `DEV_SECRETS_VALUES_DIR`); `.gitignore` here blocks `values.*.json`.

| File | What it holds |
|---|---|
| `services.json` | Runnable services: local URL, local API key (`dev`), their projects. |
| `map.json` | Repos, and per project: config key → value name or routing reference. |
| `D:/Projects/dev-secrets/values.remote.json` | Named values for the remote (Azure dev) infrastructure: connection strings, keys, remote service URLs. |
| `D:/Projects/dev-secrets/values.local.json` | `"$extends": "remote"` plus values that differ for local infrastructure (used with `-Values local`). |
| `Use-DevSecrets.ps1` | Writes the secrets and routing of the services you run locally into their .NET user secrets. |
| `Use-LocalPatches.ps1` + `patches/` | Local-only code fixes, applied and hidden from git. |

## Configure a local run

```powershell
./Use-DevSecrets.ps1 -Local signals                        # Signals locally, all dependencies remote
./Use-DevSecrets.ps1 -Local signals,verifications          # Signals calls the local Verifications API
./Use-DevSecrets.ps1 -Local signals,patients,verifications # Signals calls local Patients and Verifications
./Use-DevSecrets.ps1 -Local pvs-web,signals                # portal calls the local Signals API
./Use-DevSecrets.ps1 -Local signals -DryRun                # check only
```

Then restart the AppHosts / services.

- `-Local` lists the services you run. Only their projects are written. Their calls to each other go to localhost with key `dev`; every other call goes to the remote instance.
- Services: `signals`, `patients`, `verifications`, `bff`, `mappings`, `configuration`, `pvs-web`, `pvs-api`, `pvs-internal-api`, `pvs-background`, `vapi` (see `services.json` for URLs and projects).
- `-All` writes every project (with the same routing), `-Project "<repo>/<path pattern>"` a subset.
- `-Values local` uses `values.local.json` (local databases, storage, bus) instead of the remote infrastructure.

## Routing references (map.json)

| Reference | Resolves to |
|---|---|
| `@patients.url\|patients-remote-url` | `services.json` patients `localUrl` when patients is in `-Local`, else the named value |
| `@patients.key\|signals-patient-api-key` | patients `localKey` (`dev`) when local, else the named value |
| `@patients.key` | always the local key: the service's own inbound key (e.g. Patients AppHost `parameters:api-key`) |

Local inbound keys: Signals, Verifications and BFF read `ApiKey=dev` from their `launchSettings.json`; Patients and Mappings get theirs from the AppHost `parameters:api-key`, which the script sets to `dev`.

## Where things are stored

- User secrets: `%APPDATA%/Microsoft/UserSecrets/<UserSecretsId>/secrets.json`. Shared by every worktree of a project. Loaded only when the environment is `Development`, and overridden by environment variables (e.g. `launchSettings.json`).
- Each run overwrites the mapped keys and keeps the others (e.g. Aspire's). The first run saves `secrets.json.bak`.
- The script validates every selected project and value first and writes nothing if anything is missing.

## Add a value, key, project or service

- New secret: add the value to `values.remote.json` and `"<config key>": "<value name>"` under the project in `map.json` (`:` for nesting).
- New call to another service: map the URL and key settings to `@<service>.url|<remote value>` and `@<service>.key|<remote value>`.
- New project: give it a `UserSecretsId` (in the project or in `D:/Projects/Directory.Build.props`), add it to `map.json` and to its service's `projects` in `services.json`.
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

- `runner-allow-net-authority.patch`: the runner passes `host:port`, not a URL, to Deno's `--allow-net` (needed on Windows, where the runner uses HTTP instead of Unix sockets).
- Patched files are marked `skip-worktree`: `git status` and `git add .` ignore them. The mark is per checkout, so run the script in each new worktree.
- If a pull or checkout says the file "would be overwritten", run with `-Release`, discard the file, pull, then run again.

## Agent skill

`skills/dev-local-run/SKILL.md` teaches agents to use this tool ("configure Signals for a local run", "Signals and Verifications locally").

- Claude Code: `C:/Users/gayda/.claude/skills/dev-local-run` is a junction to this folder, so edits here apply directly.
- adoa: `Adoa/docker-compose.yml` mounts `../DevSecrets/skills` read-only as `/app/DevSecrets/skills` and lists it in `SKILL_FOLDERS` (agent-runner and web).
