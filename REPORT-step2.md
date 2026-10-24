# Step 2 report: Codex wired into PowerLoom

Branch `feature/powerloom-openai-wiring`, from `main` at `bbe1d61`. One commit; not merged, no PR.

## What was wired

| # | Item | Done | Main files | Tests |
|---|---|---|---|---|
| 1 | Runner registers Codex | `CodexSdkRuntime({ keepConversations: true, codexHome })` is registered whenever `CODEX_HOME` is set; the start-up line lists both providers | `apps/agent-runner/src/main.ts` | typecheck |
| 2 | Codex connected check | `openai-codex` runs only while `<CODEX_HOME>/auth.json` exists, else the task is blocked with "Connect Codex in Settings → AI providers, then Re-run the task." A provider without a registered runtime gets the same message | `packages/agents/src/providerConnections.ts`, `codex/CodexHome.ts` | `providerConnections.test.ts`, `codex/CodexHome.test.ts` |
| 3 | Compose, image, install | `CODEX_HOME: /codex-home` and `./agent-homes/codex:/codex-home` on the agent-runner; `/agent-homes/` git-ignored; `install.ps1` creates `agent-homes/codex`; `Dockerfile.apps` runs `codex --version` after `npm ci`, so a missing Linux binary fails the build | `docker-compose.yml`, `.gitignore`, `scripts/install.ps1`, `Dockerfile.apps` | The binary was run on `node:24-alpine` here: `codex-cli 0.164.0` |
| 4 | Connect Codex | Runner routes `GET /codex/status`, `POST /codex/login/start`, `GET /codex/login/status`, `DELETE /codex/login`, `PUT /codex/login-file`. Backend `CodexConnection` and `ICodexLogin`/`RunnerCodexLogin` behind `POST/GET/DELETE /api/ai-providers/codex/login` and `PUT /api/ai-providers/codex/login-file`. `GET /api/ai-providers` lists Codex. Web `CodexConnectForm.tsx` shows the status, the ChatGPT setting note, the built-in tools limit, the link and code (or the CLI's raw text), Disconnect, and the `auth.json` upload | `packages/agents/src/codex/*`, `apps/agent-runner/src/runnerServer.ts`, `Features/AiProviders/*`, `apps/web/app/settings/CodexConnectForm.tsx`, `actions.ts` | `codex/CodexDeviceLogin.test.ts`, `codex/deviceCodeOf.test.ts`, `apps/agent-runner/src/runnerServer.test.ts`, `AiProviders/AiProvidersTests.cs` |
| 5 | Chat app | `CodexDesktopLauncher` registered. `ChatAppChoices` marks each app connected (Claude always, Codex when connected) and `PUT /api/chats/app` refuses an app that isn't. The form offers connected apps plus the current choice | `ChatLaunchSetup.cs`, `Features/Continue/ChatAppChoices.cs`, `ChatsEndpoints.cs`, `Models/ChatApp.cs`, `ChatAppForm.tsx`, `lib/chatApps.ts` | `Continue/ChatAppTests.cs`, `lib/chatApps.test.ts` |
| 6 | Vault MCP file for Codex | `CodexConfigFile` registered; Add vault and the start-up refresh write `.mcp.json` and `.codex/config.toml` | `VaultsFeature.cs`, `VaultInitializer.cs` | `Vaults/AddVaultTests.cs` |
| 7 | Configure with Codex | Two new steps: copy `~/.claude/CLAUDE.md` into `~/.codex/AGENTS.md` (append under a heading, ask first, never remove), and copy every skill folder of `~/.claude/skills` into `~/.agents/skills` (names `create-branch` and `www-record`; asks before overwriting one that differs) | `CodexDesktopLauncher.cs` | `Continue/CodexDesktopLauncherTests.cs` |
| 8 | Models and prices | `gpt-6.1-sol` and `gpt-6-astra` (provider `openai-codex`); prices from 2026-10-24 with the source line naming the missing long-context and speed tiers | `AgentConfig/src/modelCatalogData.ts`, `AgentUsage/src/prices.json` | `AgentUsage/src/PriceBook.test.ts` |
| 9 | Vault templates | Both MCP files named | `templates/vault/POWERLOOM.md`, `AGENTS.md` | AddVault tests |
| 10 | Docs | Codex as a second provider and chat app, Connect Codex, `agent-homes/codex` | `README.md`, `PowerLoom/README.md` | n/a |

Also changed:
- `RunnerHttp` (new, `Infrastructure/Runner`) is the runner call helper that `RunnerAzureUserLogin` had inline. Azure now uses it too, so Codex reuses it without a copy. The ReadAzure tests pass.
- `@powerloom/agents` depends on `@openai/codex` `0.164.0` directly, since it spawns the CLI. The lock gains one line. The local npm rewrote unrelated `libc` fields, so that rewrite was reverted and the line added by hand. `npm ci` accepts the lock.
- `apps/agent-runner` and `apps/web` already had or now have a `test` script. The web one came from Step 1.

## Added after the brief: AI providers at installation (owner's request)
- `PowerLoom/scripts/Set-AiProviders.ps1`, run by `install.ps1` once PowerLoom answers and runnable alone any time. Each
  part is optional (Enter skips) and a connected provider is left as it is:
  - **Claude:** the token from `-ClaudeToken`, `$env:CLAUDE_CODE_OAUTH_TOKEN`, or a hidden prompt, saved through
    `PUT /api/ai-providers/claude/token`.
  - **Codex:** `-ConnectCodex` or a yes/no prompt. It reminds you of the ChatGPT setting, shows the link and code (or
    the CLI's text) and waits up to 15 minutes for the sign-in.
  - **Chat app:** `-ChatApp`, or a numbered prompt when more than one app is connected.
- `install.ps1` takes `-ClaudeToken`, `-ConnectCodex`, `-ChatApp` and `-SkipProviders` and passes them on.
- Tests: `PowerLoom/scripts/Tests/Set-AiProviders.Tests.ps1` (Pester, 14 pass). The script also ran against a live API
  here: it saved the Claude token, reported an unreachable runner as "Codex: not connected", and passed the API's
  refusal of an unconnected chat app on. That live run caught a bug the mocks hid (a JSON array answer read as one
  object), now fixed and covered by a test.

## Checks run here

| Check | Result |
|---|---|
| `npm run typecheck` | pass |
| `npm test -w @agenttools/runtime` | 41 pass |
| `npm test -w @agenttools/usage` | 4 pass |
| `npm test -w @powerloom/agents` | 199 pass |
| `npm test -w @powerloom/web` | 5 pass |
| `npm test -w @powerloom/agent-runner` | 4 pass |
| `npm run build -w @powerloom/web` | pass |
| `dotnet build PowerLoom/PowerLoom.slnx` | pass, the one warning that `main` already has |
| `dotnet test PowerLoom/tests/PowerLoom.Api.Tests` | 206 pass, 1 fail: `AddRecordTests.A_submitted_finding_goes_into_the_register_closes_and_renders_its_pbi`, which fails on `main` too |

## Not run here
- **Pester** for VaultUsage and VaultCapture ran here after all (PowerShell 7.6 as a .NET tool, Pester 5.7.1): 90 pass,
  1 fails. The failure is `CodexToolUsage.Tests.ps1`, "records a real Bash payload through stdin with a Unicode working
  directory". Its note file starts with a dot, which Linux treats as hidden, so `Get-Item` without `-Force` doesn't find
  it. It should pass on Windows. Neither module was changed here.
- **The device sign-in itself**: `auth.openai.com` is blocked from this container, so the real `codex login --device-auth` output was never seen. The parser looks for an https link and a code like `ABCD-12345`, and the page shows the CLI's raw text when either is missing.
- **A Codex run in the runner, the docker image build, the deploy, and the desktop apps.**

## Open points
- **Agents with a missing login are blocked, not retried.** This matches Claude's check from Step 1. Re-run after connecting.
- **A chosen chat app that later disconnects stays chosen.** The buttons still open Codex; the picker shows it as "(not connected)". Say if it should fall back to Claude instead.
- **Rules and skills are copied per vault.** "Configure with Codex" runs once per vault, but the copy is per PC. The steps skip what is already there, so a second vault only asks again for files that changed.
- **Built-in tools.** Codex's own tools can't all be switched off; Settings says so under Codex, as asked.

## Requests
None. Nothing under `AgentRuntime/src/adapters/**`, `AgentRuntime/src/models/**`, `IChatLauncher`, `ChatRequest`, the hook adapters or `agentDefaults.ts` was changed.

## What to do on the PC
1. Bring the branch over as a patch and apply it on a branch off `main`. On a fresh PC, `install.ps1` now offers the
   providers at its end, which covers steps 4 to 6 below.
2. Create `PowerLoom/agent-homes/codex` if it is missing (`install.ps1` does it on a fresh install).
3. Rebuild: `pwsh PowerLoom/scripts/deploy-web.ps1 -WithApi -WithRunner`. The image build now stops if the Codex Linux binary is missing.
4. In ChatGPT → Settings → Security, switch on **Device code authorization**.
5. Settings → AI providers → **Connect Codex**: open the link, enter the code, wait for "Connected". If the device flow fails, upload `~/.codex/auth.json` from a PC where `codex login` worked.
6. Choose **Codex** as the chat app.
7. **Configure with Codex** on a test vault: hooks trusted, the rules and skills copied, `status_get` answers.
8. One **Continue with Codex** click on a PBI.
9. Switch one agent to `openai-codex` / `gpt-6.1-sol` on the Agents page and run it once.
