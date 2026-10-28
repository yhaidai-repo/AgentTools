import { join } from "node:path";
import type { AgentDefinition } from "@agenttools/config";
import type { ToolDefinition } from "@agenttools/runtime";
import type { CommandResult } from "@powerloom/sandbox";
import { z } from "zod";
import type { AgentDeps } from "../models/AgentDeps";
import type { OutsideAccessContext } from "../models/OutsideAccessContext";
import type { RepoAccess } from "../models/RepoAccess";
import type { OutsideToolResult } from "../models/OutsideToolResult";
import { defineOutsideTool } from "../outsideAccess";
import { refusalOf } from "./commandRefusals";
import { createEditTools } from "./editTools";
import type { RunSandbox } from "./models/RunSandbox";
import type { SandboxAccess } from "./models/SandboxAccess";
import { repoSnapshot } from "./repoSnapshot";
import { failure, noSandbox, resourceOf } from "./sandboxResults";
import { createSessionTools } from "./sessionTools";

export const SANDBOX_INTEGRATION = "sandbox";

// The sandbox outlives the run by this much at most when nothing removes it (the service's own clock).
const TTL_MARGIN_MINUTES = 10;
const DEFAULT_TIMEOUT_MS = 120_000;
const MAX_TIMEOUT_MS = 600_000;
const REQUEST_CHARS = 500;

// The sandbox tools (design agent-sandbox, user decisions 2026-10-28): an isolated Linux container per run with the
// run's repos copied in, no network and none of the runner's secrets, where the agent builds, tests and runs scripts.
// The same tools for every provider, shaped like the ones the models know (Bash, Codex's exec_command and
// apply_patch, Claude's Edit). The container is removed when the run ends; every call goes to the data access log.
export function createSandboxTools(deps: AgentDeps, agent: AgentDefinition, context: OutsideAccessContext, repos: RepoAccess): ToolDefinition<any>[] {
  const isOn = agent.capabilities.integrations?.[SANDBOX_INTEGRATION] === true;

  if (!isOn || !deps.sandbox) {
    return [];
  }

  const access = deps.sandbox;
  const sandbox: RunSandbox = { info: null, repos: [] };
  const ttlMinutes = agent.limits.timeoutMinutes + TTL_MARGIN_MINUTES;

  return [
    openTool(deps, context, access, sandbox, repos, ttlMinutes),
    runCommandTool(deps, context, access, sandbox),
    ...createSessionTools(deps, context, access, sandbox),
    ...createEditTools(deps, context, access, sandbox),
    closeTool(deps, context, access, sandbox),
  ];
}

function openTool(deps: AgentDeps, context: OutsideAccessContext, access: SandboxAccess, sandbox: RunSandbox, repos: RepoAccess, ttlMinutes: number) {
  return defineOutsideTool(deps.outside, context, {
    name: "sandbox_open",
    description: "Open your sandbox before any other sandbox tool: a Linux container with your repos copied in at /workspace/<repo> (each a git repo of its own at the run's commit), where you can build, run tests, grep and run scripts. It has no network: packages a build needs and doesn't already have can't be fetched. Call it again to copy in more repos (open_repo first). Nothing you change leaves the sandbox: put what you found in your result.",
    input: { repos: z.array(z.string().min(1)).optional().describe("Repos to copy in, by name as the repo tools name them; leave out for every repo of your run") },
    resource: (input) => resourceOf(access, sandbox, (input.repos ?? []).join(",")),
    request: (input) => `open${input.repos ? ` with ${input.repos.join(", ")}` : ""}`,
    handler: async (input) => {
      const known = repos.repos.map((repo) => repo.name);
      const wanted = input.repos ?? known;
      const unknown = wanted.filter((name) => !known.includes(name));

      if (unknown.length > 0) {
        return { text: `Not repos of this run: ${unknown.join(", ")}. Your repos: ${known.join(", ") || "none"}; add one with open_repo first.`, isError: true };
      }

      const opened = await ensureOpen(access, sandbox, context.owner, ttlMinutes);

      if (opened) {
        return opened;
      }

      const copied = await copyRepos(deps, access, sandbox, repos, wanted.filter((name) => !sandbox.repos.includes(name)));

      return copied ?? { text: layoutText(sandbox, repos), rows: sandbox.repos.length };
    },
  });
}

function runCommandTool(deps: AgentDeps, context: OutsideAccessContext, access: SandboxAccess, sandbox: RunSandbox) {
  return defineOutsideTool(deps.outside, context, {
    name: "run_command",
    description: "Run a bash command in your sandbox and wait for it to end: builds, tests, grep/rg, git status/diff, scripts. Each call is a fresh shell (cd and variables don't carry over: use `cd repo && …`); use exec_command for a shell that keeps its state or a process that keeps running. Stdout and stderr come back together; long output is cut in the middle and kept whole in the file the answer names.",
    input: {
      command: z.string().min(1).describe("The bash command"),
      cwd: z.string().optional().describe("Folder to run it in, under /workspace (default /workspace)"),
      timeout: z.number().int().min(1_000).max(MAX_TIMEOUT_MS).optional().describe(`Milliseconds before it is killed (default ${DEFAULT_TIMEOUT_MS}, max ${MAX_TIMEOUT_MS})`),
      description: z.string().optional().describe("What the command does, in a few words"),
    },
    resource: (input) => resourceOf(access, sandbox, input.cwd),
    request: (input) => input.command.slice(0, REQUEST_CHARS),
    handler: async (input) => {
      const refusal = refusalOf(input.command);

      if (refusal) {
        return { text: refusal, isError: true, refusal };
      }

      if (!sandbox.info) {
        return noSandbox();
      }

      const answer = await access.client.run(sandbox.info.id, { command: input.command, cwd: input.cwd, timeoutMs: input.timeout ?? DEFAULT_TIMEOUT_MS });

      return answer.ok ? commandText(answer.value) : failure(answer);
    },
  });
}

function closeTool(deps: AgentDeps, context: OutsideAccessContext, access: SandboxAccess, sandbox: RunSandbox) {
  return defineOutsideTool(deps.outside, context, {
    name: "sandbox_close",
    description: "Remove your sandbox and everything in it now. Optional: it is removed when your run ends anyway.",
    input: {},
    resource: () => resourceOf(access, sandbox),
    request: () => "close",
    handler: async () => {
      if (!sandbox.info) {
        return noSandbox();
      }

      const answer = await access.client.remove(sandbox.info.id);

      sandbox.info = null;
      sandbox.repos = [];

      return answer.ok ? { text: "The sandbox is removed." } : failure(answer);
    },
  });
}

async function ensureOpen(access: SandboxAccess, sandbox: RunSandbox, owner: string, ttlMinutes: number): Promise<OutsideToolResult | null> {
  if (sandbox.info) {
    return null;
  }

  const answer = await access.client.open({ owner, ttlMinutes });

  if (!answer.ok) {
    return failure(answer);
  }

  sandbox.info = answer.value;

  return null;
}

async function copyRepos(deps: AgentDeps, access: SandboxAccess, sandbox: RunSandbox, repos: RepoAccess, names: string[]): Promise<OutsideToolResult | null> {
  for (const name of names) {
    const commit = repos.commits[name] ?? "unknown";
    const answer = await access.client.uploadRepo(sandbox.info!.id, name, repoSnapshot(join(deps.repoCache.root, name)), `base ${commit}`);

    if (!answer.ok) {
      return failure(answer);
    }

    sandbox.repos.push(name);
  }

  return null;
}

function layoutText(sandbox: RunSandbox, repos: RepoAccess): string {
  const info = sandbox.info!;
  const lines = sandbox.repos.map((name) => `- ${info.workspace}/${name} (commit ${(repos.commits[name] ?? "unknown").slice(0, 12)})`);
  const toolchains = info.toolchains ? `\nToolchains: ${info.toolchains}` : "";

  return `Sandbox ${info.id} is open until ${info.expiresAt}.\nRepos:\n${lines.join("\n") || "- none"}${toolchains}\nNo network; Linux only (projects that need Windows don't build here). git status / git diff show your changes.`;
}

function commandText(result: CommandResult): OutsideToolResult {
  const seconds = (result.durationMs / 1000).toFixed(1);
  const status = result.timedOut ? `Timed out after ${seconds} s and was killed` : `Exit code ${result.exitCode} (${seconds} s)`;

  return { text: `${status}\n${result.output}`, isError: result.timedOut, truncated: result.truncated };
}
