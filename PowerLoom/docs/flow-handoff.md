# PowerLoom Flow: handoff (2026-11-06)

State of the PowerLoom split work and what is left. Written for whoever continues on another machine, person or agent.
Design and plan live in the docs vault (`personal-projects`, folder `adoa/flow/`): `powerloom-flow-design.md`,
`powerloom-flow-plan.md`; parent idea `adoa/architecture/powerloom-services-split.md`. The summary below is enough to
continue without them.

## Goal
Split PowerLoom into three apps, each its own compose service with its own header and links to the others, all writing
through the one write API (commands → `PowerLoomPort` → .NET endpoints):
- **Flow** (new, first): N8N-like canvas. A flow is a reusable workflow of agent nodes with **required** and
  **optional** edges, run for a PBI or a task. An execution is the group of ordinary tasks it creates, one per node.
- **Configuration**: today's Settings and vault configuration.
- **Management**: the rest of today's pages (Agents, PBIs, Tasks, Runs, Reviews, Vault, Dashboard). Today's behaviour
  (tasks, chaining v2, re-run, schedules) must keep working there without any flow.

## Branches (both pushed, neither merged into `main`)
| Branch | Base | Holds |
|---|---|---|
| `powerloom-flow-prototype` | `main` `cef60f51` | phases 0–3 below |
| `powerloom-parallel-runs` | `main` `cef60f51` | phase 5 below, independent of Flow |

Nothing is deployed. The compose image was never rebuilt from these branches and **the migration
`20261103205608_Flows` has never run against a real database** (only the tests' throwaway Postgres).

## Phases
| # | Phase | State | Commit(s) |
|---|---|---|---|
| 0 | UI prototype `apps/flow` (canvas, mocked run) | done, checked in the browser | `a1570dce` |
| 1 | Flow aggregate: tables `flow`, `flow_execution`, endpoints, commands `flow.*` | done, suites green | `7804a079` |
| 2 | Engine: creates and advances the tasks, hand-off rows, hooks, steps view | done, suites green, **no live run** | `9b2cf022`, `ada82422` |
| 3 | Flow app on the real API (reads, server actions, run dialog, executions, web flow tag) | **code complete, builds and unit tests green, never run against a migrated database, no browser check** | `04e7185c` and the commit that adds this file |
| 4 | Project entity (holds PBIs and tasks; Flow picks targets per project) | not started | – |
| 5 | Parallel agent runs (`RUNNER_MAX_PARALLEL_RUNS`) | done on its own branch, suites green, **no live run** | `5698a9e9` |
| 6 | Triggers (ADO events, schedule, manual, custom) | deferred by the user, design open | – |
| 7 | Configuration and Management apps | not started | – |

## What to do next, in order
1. **Verify phase 3 live.** Bring a stack up from `powerloom-flow-prototype` on a scratch database (never the real
   one first): the backend applies the Flows migration at start. Then in the Flow app (`http://127.0.0.1:3120`): create
   a flow (Trigger → agent A required → agent B; A optional → C), Save (version shows), reload, Run for a PBI, watch
   `/executions/<id>` poll, check the tasks in the web app carry the `flow FX-nnn` tag, cancel one execution, delete a
   flow. Take the `phase3-*` screenshots into `apps/flow/docs/`.
2. **First real execution** with an enabled agent pair, e.g. `better-refinement` → `design`: confirm the downstream
   task receives `<handoff>` with the upstream result (`refs.results: RUN-n`), and that the dispatcher starts it
   without waiting for cron.
3. Decide the open points below, then phase 4, then phase 7. Phase 6 waits for the trigger design.
4. Merge order when ready: `powerloom-parallel-runs` and `powerloom-flow-prototype` both branch from the same `main`
   commit and touch `docker-compose.yml`, `openapi/PowerLoom.Api.json`, `packages/client/src/schema.d.ts` and
   `package-lock.json`: expect conflicts there; regenerate the OpenAPI json and the client after merging instead of
   resolving by hand.

## How it works (as built)
- **Definition** (`packages/core/src/models/FlowDefinition.ts`, zod; mirrored by `FlowDefinitionRules.cs`):
  `nodes: [{id: "trigger", type: "trigger", position} | {id, type: "agent", agent, kind, title, runs?, position}]`,
  `edges: [{id, from, to, kind: "required" | "optional"}]`. One trigger, unique ids, no cycle through required edges,
  each node's `kind` must be in its agent's `handles`.
- **API**: `PUT /api/flows`, `DELETE /api/flows/{id}` (409 while an execution runs), `POST /api/flows/{id}/run`
  (`{vault, target: {kind: "pbi", pbiId} | {kind: "task", itemId}}`), `POST /api/flow-executions/{id}/cancel`.
  Commands: `flow.save|delete|run|cancel|list|get|executions|execution`. Ids `FL-nnn`, `FX-nnn` (global).
- **Engine** (`src/PowerLoom.Core/Features/Flows/Engine/`, `FlowAdvancer`): run creates the tasks of nodes fed by the
  trigger or without incoming edges. A required edge creates the next task when all required predecessors are Done,
  with `dependsOn` and a `handoff` row (`intent continue`, refs = last successful run) so the agent reads the upstream
  result as with any hand-off. Optional-only nodes are never created by the engine: the upstream agent decides with
  its own `create_task` (its `canAssign` must allow it). Tasks carry
  `data.{flowExecutionId, flowNodeId, flowId, flowVersion, key, createdBy: "flow"}`, are pinned `agent:<id>`, bypass
  `OnePerPbi` and the per-PBI cap; tasks an agent creates inside an execution inherit the markers.
  Advance runs on the runner callback (`AgentRunSaga`), on a person's close (`CloseItemEndpoint`) and every minute
  (`FlowCronSource`), idempotent under an advisory lock. Status: `failed` on a cancelled node task, Blocked keeps the
  execution running, `done` when every node task and inherited item is closed, cancel cancels the open flow tasks.
  Re-run of a node task reopens that task only.
- **Flow app** (`apps/flow`, see its README): reads through drizzle (`@powerloom/core`), writes through the commands;
  vault from the web's cookie `powerloom_vault` (shared on `127.0.0.1`); pages `/`, `/flows/new`, `/flows/<id>`,
  `/executions`, `/executions/<id>`; shows a notice instead of failing when the flow tables are missing.
- **Parallel runs** (other branch): runner slots by task id, `/health` lists `runningTasks` and `maxParallelRuns`,
  dispatch claims at most the free slots, startup sweeps skip live runs, in-process DevHub lease, budget reservation.
  Default 1 = today's behaviour.

## Decisions (the user's)
Three separate apps, Flow first; each app its own header with external links; single user, no roles; a node is an
agent (more node kinds later); "3 runs" on a node = today's re-run, no fan-out; blockers go to the user as human
tasks, as today; output passes through the hand-off feature; a saved flow change applies to executions started after
the save; drag-and-drop canvas; reuse today's Run and Tasks pages by link; a Project entity holds PBIs and tasks;
agents should work on several tasks in parallel; triggers later.

## Assumptions made while building (confirm or change)
- Blocked node task keeps the execution running; only cancelled, dismissed or deleted fail it.
- `done` also waits for items an agent created inside the execution (human tasks, questions).
- Cancel leaves an in-progress task to finish its run and does not close human items.
- Ids are global, not per vault; a flow cannot change vault; a duplicate name in a vault is refused.
- The Flow header shows the vault read-only; switching stays in the web app.
- Parallel runs: the cap is read from the runner's `/health`; the DevHub lease waits 5 minutes then refuses; the
  budget reservation is the agent's `perRunUsd`, kept in the runner process.

## Open points
- "Project" clashes with the docs-vault project folder (`PbiDocsProject`, `data.project`): pick the name.
- Does a node choose the task kind (built this way) or should the agent imply it?
- Required edge on Done only (built) or also on other closes?
- `otherAgentTasks` in an agent's `waitFor` serialises parallel branches of a flow on one PBI.
- Reads bypass the API (as web does); a GET surface would be the clean fix.
- Trigger kinds and where they live next to today's schedules.

## Checks (green on 2026-11-06 unless dated otherwise)
```
npm ci                                   # repo root
npm run typecheck                        # all workspaces
npm run test -w @powerloom/flow          # 6
npm run test -w @powerloom/core          # 142
npm run test -w @powerloom/agents        # 582 pass, 6 skipped (2026-11-04)
npm run build -w @powerloom/flow
npm run build -w @powerloom/web
dotnet test PowerLoom/tests/PowerLoom.Api.Tests   # 454 (2026-11-04; needs Docker for Testcontainers; ~10 min; run alone)
```
The .NET suite gets load timeouts when another heavy job runs beside it.
