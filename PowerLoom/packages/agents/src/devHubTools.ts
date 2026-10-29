import type { AgentDefinition } from "@agenttools/config";
import type { ToolDefinition } from "@agenttools/runtime";
import { waitForStack, type DevHubAnswer, type StackServiceState, type StackStatus, type StackWait } from "@powerloom/devhub";
import { toMarkdownTable } from "@powerloom/sql";
import { z } from "zod";
import { createBrowserTools } from "./browser/browserTools";
import { createSecretTools } from "./browser/secretTools";
import type { AgentDeps } from "./models/AgentDeps";
import type { DevHubAccess } from "./models/DevHubAccess";
import type { OutsideAccessContext } from "./models/OutsideAccessContext";
import type { OutsideResource } from "./models/OutsideResource";
import type { OutsideToolResult } from "./models/OutsideToolResult";
import { defineOutsideTool } from "./outsideAccess";

// "localStack": the stored key from before the rename to DevHub (2026-10-14): agents' saved switches keep working.
export const DEVHUB_INTEGRATION = "localStack";
// DevHub knows a stack started by a run under this prefix plus the run id.
export const RUN_OWNER_PREFIX = "powerloom-run-";
// A chat session's stack (user decision 2026-10-24: a chat is not a run); the MCP server stops it with the session.
export const CHAT_OWNER_PREFIX = "powerloom-chat-";

// A start builds and starts up to five apps; past this the tool hands back and the agent checks stack_status.
const START_WAIT_MS = 6 * 60_000;
const POLL_MS = 5_000;
// The stack outlives the run by this much at most when nothing stops it (DevHub's own clock).
const TTL_MARGIN_MINUTES = 10;
const DEFAULT_LOG_LINES = 200;
const MAX_LOG_LINES = 2_000;
const FAILURE_OUTPUT_LINES = 40;
// A log's text is cut here so one chatty service can't fill the agent's context (as for SQL answers).
const MAX_ANSWER_CHARS = 60_000;

// The DevHub tools (user decision 2026-10-13), for an agent with the integration switched on in its Config while
// its vault's DevHub is on: start a chain of the vault's services on the Windows host (DevHub),
// pointed at each other, read their logs, stop them, and drive a recorded browser against them (2026-10-20). A stack
// and a browser case belong to the run that started them; the runner stops them when the run ends. Every call goes
// to the data access log.
export function createDevHubTools(deps: AgentDeps, agent: AgentDefinition, context: OutsideAccessContext): ToolDefinition<any>[] {
  const isOn = agent.capabilities.integrations?.[DEVHUB_INTEGRATION] === true;

  if (!isOn || !deps.devHub) {
    return [];
  }

  const access = deps.devHub;
  const owner = context.owner;

  return [
    listServicesTool(deps, context, access),
    startStackTool(deps, context, access, owner, agent.limits.timeoutMinutes + TTL_MARGIN_MINUTES),
    stackStatusTool(deps, context, access, owner),
    stackLogsTool(deps, context, access),
    stopStackTool(deps, context, access, owner),
    ...createSecretTools(deps, context, access),
    ...createBrowserTools(deps, context, access, owner, isHeadless(agent)),
  ];
}

// The agent's "Headless browser" option: 0 shows a browser window on the host (user request 2026-10-20); default hidden.
export function isHeadless(agent: AgentDefinition): boolean {
  return (agent.options as { headless?: number } | undefined)?.headless !== 0;
}

// The runner stops the run's stack by this name when the run ends.
export function stackOwner(runId: number): string {
  return `${RUN_OWNER_PREFIX}${runId}`;
}

// The MCP server stops the session's stack by this name when the session ends.
export function chatOwner(sessionId: string): string {
  return `${CHAT_OWNER_PREFIX}${sessionId}`;
}

function listServicesTool(deps: AgentDeps, context: OutsideAccessContext, access: DevHubAccess) {
  return defineOutsideTool(deps.outside, context, {
    name: "list_services",
    annotations: { readOnly: true },
    description: "List the services that can run locally (web apps, background hosts, message consumers, …): name, what it is, local URL, whether it consumes the message bus (then a local RabbitMQ is added), and what start_stack's config may set for it.",
    input: {},
    resource: () => resourceOf(access, "catalog"),
    request: () => "list services",
    handler: async () => {
      const answer = await access.client.services();

      if (!answer.ok) {
        return failure(answer);
      }

      const rows = answer.value.map((service) => [service.name, service.note ?? "", service.localUrl ?? "(no URL)", service.consumesBus ? "yes" : "no", service.configurable.join(", ") || "-"]);

      return { text: toMarkdownTable(["Service", "What", "Local URL", "Consumes bus", "Config"], rows), rows: rows.length };
    },
  });
}

const WORKER_INPUT = z.object({
  RunAtStart: z.boolean().optional().describe("Run once as the host starts"),
  Cron: z.string().optional().describe("How often: a cron expression, or a number of seconds like \"15\""),
  DegreeOfParallelism: z.number().int().positive().optional(),
}).describe("The worker's fields to change; the rest keep the host's defaults");

const CONFIG_INPUT = z.record(z.string().min(1), z.object({
  workers: z.record(z.string().min(1), WORKER_INPUT).optional().describe("Background workers to run, by name as the host's workerConfigs.json names them; the host runs no other worker"),
})).optional().describe("Per configurable service (the Config column of list_services): what to set for this stack. A background host without workers runs none of them, so name the worker a case waits on, with RunAtStart and a short Cron");

function startStackTool(deps: AgentDeps, context: OutsideAccessContext, access: DevHubAccess, owner: string, ttlMinutes: number) {
  return defineOutsideTool(deps.outside, context, {
    name: "start_stack",
    description: "Start a chain of local services pointed at each other (every other dependency stays on the shared environment) and wait until they are ready, up to 6 minutes. Only one stack runs at a time; it stops when the run or chat session that started it ends. Pick names with list_services.",
    input: {
      services: z.array(z.string().min(1)).min(1).describe("Service names from list_services, e.g. [\"web\", \"orders-consumer\"]"),
      branch: z.string().optional().describe("Run this branch's code (its worktree per repo); leave out for the main checkouts"),
      strictBranch: z.boolean().optional().describe("Refuse fallback to a different branch; required by demonstration guides"),
      config: CONFIG_INPUT,
    },
    resource: (input) => resourceOf(access, input.services.join(",")),
    request: (input) => `start ${input.services.join(", ")}${input.branch ? ` on ${input.branch}` : ""}${workersRequested(input.config)}`,
    handler: async (input) => {
      const started = await access.client.start({ services: input.services, branch: input.branch, ttlMinutes, owner, config: input.config, ...(input.strictBranch ? { strictBranch: true } : {}) });

      if (!started.ok) {
        return failure(started);
      }

      return waitResult(await waitForStack(() => access.client.status(), { timeoutMs: START_WAIT_MS, pollMs: POLL_MS }));
    },
  });
}

// The workers a start names, for the access log: "with workers A, B".
function workersRequested(config: z.infer<typeof CONFIG_INPUT>): string {
  const workers = Object.values(config ?? {}).flatMap((service) => Object.keys(service.workers ?? {}));

  return workers.length > 0 ? ` with workers ${workers.join(", ")}` : "";
}

function stackStatusTool(deps: AgentDeps, context: OutsideAccessContext, access: DevHubAccess, owner: string) {
  return defineOutsideTool(deps.outside, context, {
    name: "stack_status",
    annotations: { readOnly: true },
    description: "Show the local stack: phase (starting, ready, failed, …), whose it is, each service with its URL and whether it runs.",
    input: {},
    resource: () => resourceOf(access, "stack"),
    request: () => "status",
    handler: async () => {
      const answer = await access.client.status();

      if (!answer.ok) {
        return failure(answer);
      }

      return { text: statusText(answer.value, owner) };
    },
  });
}

function stackLogsTool(deps: AgentDeps, context: OutsideAccessContext, access: DevHubAccess) {
  return defineOutsideTool(deps.outside, context, {
    name: "stack_logs",
    annotations: { readOnly: true },
    description: "Read the last lines of a running service's log (or its error log). Logs can hold connection strings: don't copy secrets into your output.",
    input: {
      service: z.string().min(1).describe("A service of the stack, e.g. orders-consumer"),
      lines: z.number().int().min(1).max(MAX_LOG_LINES).optional().describe(`How many lines from the end (default ${DEFAULT_LOG_LINES})`),
      error: z.boolean().optional().describe("Read the error log (stderr) instead"),
    },
    resource: (input) => resourceOf(access, input.service),
    request: (input) => `${input.error ? "error log" : "log"} of ${input.service}, ${input.lines ?? DEFAULT_LOG_LINES} lines`,
    handler: async (input) => {
      const answer = await access.client.logs(input.service, input.lines ?? DEFAULT_LOG_LINES, input.error ?? false);

      if (!answer.ok) {
        return failure(answer);
      }

      return cutText(answer.value.lines.join("\n"), answer.value.lines.length);
    },
  });
}

function stopStackTool(deps: AgentDeps, context: OutsideAccessContext, access: DevHubAccess, owner: string) {
  return defineOutsideTool(deps.outside, context, {
    name: "stop_stack",
    description: "Stop the local stack this run or chat session started (every service and the local RabbitMQ). Stop it as soon as your checks are done.",
    input: {},
    resource: () => resourceOf(access, "stack"),
    request: () => "stop",
    handler: async () => {
      const answer = await access.client.stop(owner);

      if (!answer.ok) {
        return failure(answer);
      }

      return { text: ["Stopped.", ...answer.value.output.slice(-FAILURE_OUTPUT_LINES)].join("\n") };
    },
  });
}

function waitResult(answer: DevHubAnswer<StackWait>): OutsideToolResult {
  if (!answer.ok) {
    return failure(answer);
  }

  const { status, timedOut } = answer.value;

  if (timedOut) {
    return { text: `Still starting after ${START_WAIT_MS / 60_000} minutes; check again with stack_status.\n\n${statusText(status, status.owner)}` };
  }

  if (status.phase !== "ready") {
    return { text: `The stack did not start (${status.phase}); everything it started was stopped.\n\n${statusText(status, status.owner)}\n\nLast output:\n${status.output.slice(-FAILURE_OUTPUT_LINES).join("\n")}`, isError: true };
  }

  return { text: `Ready.\n\n${statusText(status, status.owner)}` };
}

function statusText(status: StackStatus, owner: string | null): string {
  const whose = status.owner === null ? "not started by an agent" : status.owner === owner ? "yours" : `started by ${status.owner}`;
  const header = `Phase: ${status.phase}; ${status.running ? "running" : "not running"}; ${whose}${status.branch ? `; branch ${status.branch}` : ""}${status.expiresAt ? `; stops by ${status.expiresAt}` : ""}`;

  if (status.services.length === 0) {
    return header;
  }

  const rows = status.services.map((service) => [service.name, service.running ? "running" : "stopped", service.url ?? "(no URL)", workersOf(service)]);

  return `${header}\nStrict branch: ${status.strictBranch === true}\nRuntime build identity: ${JSON.stringify(status.buildIdentity ?? {})}\n\n${toMarkdownTable(["Service", "State", "URL", "Workers"], rows)}`;
}

function workersOf(service: StackServiceState): string {
  if (!service.workers) {
    return "-";
  }

  return service.workers.length > 0 ? service.workers.join(", ") : "none";
}

function failure(answer: { message: string; denied: boolean }): OutsideToolResult {
  return { text: answer.message, isError: true, denied: answer.denied };
}

function cutText(text: string, rows: number): OutsideToolResult {
  const cut = text.length > MAX_ANSWER_CHARS ? `\n\n[cut at ${MAX_ANSWER_CHARS} of ${text.length} characters: ask for fewer lines]` : "";

  return { text: `${text.slice(0, MAX_ANSWER_CHARS)}${cut}`, rows, truncated: cut.length > 0 };
}

function resourceOf(access: DevHubAccess, resource: string): OutsideResource {
  return { kind: "localStack", resource, target: access.url };
}
