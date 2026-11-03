# PowerLoom Flow (phase 0 prototype)

An N8N-like canvas for agent workflows: a fixed **Trigger** node, today's agents as nodes, **required** (solid) and
**optional** (dashed) edges. Design and plan: the vault notes `powerloom-flow-design` and `powerloom-flow-plan`.

## Run
- Dev: `DATABASE_URL=postgres://…@127.0.0.1:5442/… npm run powerloom:dev:flow` (root) or `npm run dev -w @powerloom/flow`,
  then open <http://127.0.0.1:3120>. `WEB_URL` (default `http://127.0.0.1:3100`) is where the header's Tasks and
  Agents links go. No DB at hand: `FLOW_AGENTS_STUB=1` serves a fixed agent list.
- Compose: service `flow` in `PowerLoom/docker-compose.yml` (same image as web, `FLOW_PORT`, default 3120).
- Checks: `npm run build -w @powerloom/flow`, `npm run typecheck -w @powerloom/flow`.

## What is real
- The palette: `agent_config.agent` through `@agenttools/config` `PostgresAgentConfigStore`, read in a server
  component (`lib/agents.ts`); a node picks its task kind from the agent's `handles`.
- The header links into the web app on the same host, so the vault cookie is shared.

## What is mocked (nothing reaches PowerLoom)
- **Flows** live in this browser's `localStorage` (`powerloom-flow.flows`): name, nodes with positions, edges.
- **Run (mock)** (`lib/mockRun.ts`): the trigger fires, then every second each running node plays one run; a node
  starts when all its required predecessors are done and at least one predecessor is done (a node without incoming
  edges starts with the trigger). Optional edges start their target too, but never hold it back. A node's `runs`
  setting plays that many runs (the sketch: Agent 3 three times). Nodes nobody reaches stay "waiting".
- **Executions** live in `sessionStorage` for the tab's session (`/executions`).

## Pages
| Page | Does |
|---|---|
| `/` | the saved flows: open, delete, new |
| `/flows/<id>` | the editor: palette, canvas, Save, Run (mock), progress bar |
| `/executions` | the session's mocked executions |

Screenshots of the acceptance run: `docs/`.
