# PowerLoom Flow

An N8N-like canvas for agent workflows: a fixed **Trigger** node, today's agents as nodes, **required** (solid) and
**optional** (dashed) edges. A flow runs for a PBI or a task; the execution is the group of tasks the flow engine
creates, one per agent node. Design and plan: the vault notes `powerloom-flow-design` and `powerloom-flow-plan`.

## Run
- Dev, against the compose stack's database and API: at the repo root
  `DATABASE_URL=postgres://<user>:<password>@127.0.0.1:5442/<db> POWERLOOM_URL=http://127.0.0.1:5180 npm run powerloom:dev:flow`
  (the Postgres values are `PowerLoom/.env`'s `POSTGRES_*` and `DB_PORT`; the API port is `POWERLOOM_PORT`), then open
  <http://127.0.0.1:3120>. Save, Run, Delete and Cancel write to that database through the API.
- Compose: service `flow` in `PowerLoom/docker-compose.yml` (same image as web, host port `FLOW_PORT`, default 3120).
- Checks: `npm run typecheck -w @powerloom/flow`, `npm run test -w @powerloom/flow`, `npm run build -w @powerloom/flow`.

## Environment
| Variable | Default | Used for |
|---|---|---|
| `DATABASE_URL` | – (required) | every read: flows, executions, agents, the vaults, the Run dialog's PBIs and tasks |
| `POWERLOOM_URL` | – (required for writes) | the flow commands (`flow.save`, `flow.delete`, `flow.run`, `flow.cancel`) through `@powerloom/client` |
| `WEB_URL` | `http://127.0.0.1:3100` | the links into the web app: header (Tasks, Agents, Backlog), task, run, agent and PBI pages |
| `FLOW_AGENTS_STUB` | unset | `1` serves a fixed agent palette instead of `agent_config.agent` (a PC without the stack; reads of flows still need the DB) |

The web app links back with `FLOW_URL` (default `http://127.0.0.1:3120`): the header's "Flow ↗" and the `flow FX-nnn`
tag on a task of an execution (`data.flowExecutionId`).

## What is real (phase 3)
- **Reads** go straight to Postgres with `@powerloom/core`'s drizzle reads (`readFlows`, `readFlow`,
  `readFlowExecutions`, `readFlowExecution`), as the web reads its pages; the agent palette comes from
  `agent_config.agent` (`lib/agents.ts`); the Run dialog's PBIs and open tasks from `work_item` and `local_item`
  (`lib/targets.ts`). The vault is the web's cookie `powerloom_vault` (shared on 127.0.0.1), else the first vault
  (`lib/currentVault.ts`); the header shows it, the switch stays in the web app.
- **Writes** are commands run through PowerLoom's API (`lib/commandContext.ts`, like web's `runWebCommand`), from
  server actions in `app/actions.ts`: Save → `flow.save` (PowerLoom validates the definition, also each node's kind
  against its agent's `handles`, and bumps the version; problems show inline), Delete → `flow.delete` (refused while an
  execution runs), Run → `flow.run` (the engine creates the first nodes' tasks), Cancel → `flow.cancel`.
- Nothing is kept in the browser any more (phase 0's `localStorage` flows and `sessionStorage` mock executions are gone).

## Pages
| Page | Does |
|---|---|
| `/` | the vault's flows: name, version, nodes, updated, last execution; Run (target dialog), Open, Delete (confirm) |
| `/flows/new`, `/flows/<id>` | the editor: palette, canvas, Save (version shown after), Run, Delete, link to the flow's executions |
| `/executions` | the vault's executions, newest first, filter by flow; status, progress = done steps / steps reached (non-skipped) |
| `/executions/<id>` | the flow's canvas read-only, each node coloured by its step (pending, open, in-progress, done, blocked, cancelled, skipped) with its run count and links to the task and its latest run in the web app; the step table; Cancel while running; polls `/api/executions/<id>` every 3 s while running |
| `/api/executions/<id>` | the execution as the page draws it (JSON) |
| `/api/targets` | the Run dialog's PBIs and open tasks |

Screenshots: `docs/` (phase 0 `01`–`05`; they show the mocked prototype, phase 3 has none yet).

State and next steps: `PowerLoom/docs/flow-handoff.md`.
