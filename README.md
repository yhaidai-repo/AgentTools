# AgentTools

Tools for running AI agents over a developer's own work: Azure DevOps backlog items, pull requests, code repos and
Obsidian doc vaults. The main app is **PowerLoom**; the other folders are small reusable modules it is built from.
Everything runs locally (Docker Desktop on Windows); Azure DevOps is only read, never written.

## Tools

| Folder | What it is |
|---|---|
| [`PowerLoom/`](PowerLoom/README.md) | The agent pipeline: .NET backend (Wolverine, Postgres), TypeScript agent runner, Next.js web UI, MCP server for chats |
| `AgentRuntime/` | Provider-neutral agent runtime: models, tools, events, skills, repo checkouts; one adapter per model provider (Claude Agent SDK today) |
| `AgentConfig/` | Agent definitions (model, limits, budgets, switches, prompt versions) in Postgres or a JSON file, with change notification |
| `AgentUsage/` | Token usage, prices, budgets, subscription windows and run traces |
| [`VaultUsage/`](VaultUsage/README.md) | PowerShell module + Claude Code hook: which vault notes agents read and write, for audits and pruning |
| [`VaultCapture/`](VaultCapture/README.md) | PowerShell module + Claude Code hooks: saves session findings into vault drafts before the context is compacted |

Not published to GitHub: DevHub (starting local service stacks for agents), the Outlook mail export and the meeting audio
capture. PowerLoom keeps its clients for them; they stay switched off without the tools.

## PowerLoom features

- **Backlog sync**: pulls your PBIs and bugs from Azure DevOps per vault and sprint; imports from an inbox folder.
- **Agent pipeline**: refinement → research → design on each PBI, then "Continue with Claude" opens a desktop chat with
  the handoff note to implement it. Agents decide the next task; questions and human tasks wait for your answer.
- **Agents**: better-refinement, better-research, design, code-review, better-review, autotest (Playwright), tech-writer,
  vault-review, and `chat` for MCP sessions. Each has its prompt (versioned), model, limits, budgets and integration
  switches on the Agents page; skills under `PowerLoom/skills`.
- **Integrations (read-only)**: Azure DevOps, Confluence, SQL Server, Azure (App Insights, metrics, Service Bus, Cosmos,
  Mongo) through Microsoft's Azure MCP Server; every outside read goes to the data access log.
- **Reviews**: pulls the PRs you review; you start a review, see comments with code, answer, close or re-run; test tasks per linked PBI.
- **Vaults**: several Obsidian vaults as accounts; Add vault prepares the folder (rules, registers, MCP entry) and its
  vault review schedule (every 6 h); the tech-writer moves drafts into verified notes; Vault page shows used and unused docs.
- **Resume**: a task's next run continues the last conversation; results are kept as versions.
- **Dashboard**: application state, agent costs and runs, delivery (sprints, pipeline rates); traces in Grafana.
- **MCP server**: the whole system (PBIs, tasks, runs, agents, results, reviews, vault, usage) as tools for Claude Code
  chats, on `127.0.0.1:3110` with a bearer token; writes go through PowerLoom's API.
- **Housekeeping**: daily backups, artefact cleanup with retention, dead-letter replay.

## Install

Windows with Docker Desktop and PowerShell 7:

```powershell
git clone https://github.com/yhaidai-repo/AgentTools.git <folder>/AgentTools
cd <folder>/AgentTools/PowerLoom
pwsh scripts/install.ps1 -Vaults <vaults folder>/<vault>
```

The script writes `.env` (generated passwords, your paths), creates the
folders and the database volume, starts the stack, and adds the vaults. No path is assumed: `-Vaults` takes the vault
folders as full paths (they must share one parent folder; a missing one is created empty from the templates, so copy
your notes first), `-ReposRoot` the folder with your code repos (default: where AgentTools was cloned), `-SkillsPath`
extra agent skills (default: Claude Code's skills folder if there is one, else an empty `PowerLoom/local-skills`).
The agents come with the prompts in the code. Then open the web UI the script prints → Settings → AI providers: paste the
Claude token `claude setup-token` prints (agents run once it is saved) and pick the chat app; then Settings for Azure
DevOps per vault, and "Configure with Claude" on each vault.
Details: [`PowerLoom/README.md`](PowerLoom/README.md).

## Future plans

- **OpenAI / Codex support**: an OpenAI runtime adapter, "Continue with Codex", Codex hooks for VaultUsage and VaultCapture, Codex MCP config.
- **MCP stages 3–5**: write tools for what is web-only today, chats using the MCP instead of the CLI, chats without file access.
- **Access requests**: a refused tool becomes one human task with the fix; the task re-runs when it is closed.
- **Web documents**: agents with web access read a PBI's web links and save notes.
- **Create tasks** from the Tasks page for any agent type, with schedules.
- **Audio capture** (meeting notes agent) and **DevHub**-driven autotests, once those tools are published.
