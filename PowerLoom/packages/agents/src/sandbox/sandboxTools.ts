import type { AgentDefinition } from "@agenttools/config";
import type { ToolDefinition } from "@agenttools/runtime";
import type { CommandResult, SandboxAnswer } from "@powerloom/sandbox";
import { z } from "zod";
import type { AgentDeps } from "../models/AgentDeps";
import type { OutsideAccessContext } from "../models/OutsideAccessContext";
import type { RepoAccess } from "../models/RepoAccess";
import type { OutsideToolResult } from "../models/OutsideToolResult";
import { defineOutsideTool } from "../outsideAccess";
import { isSandboxBuildCommand } from "./buildRouting";
import { exitCodeOf, recordBuildRun } from "./buildRunLog";
import { refusalOf } from "./commandRefusals";
import { createEditTools } from "./editTools";
import type { RunSandbox } from "./models/RunSandbox";
import type { RunWorktree } from "./models/RunWorktree";
import type { RunWorktreeSlot } from "./models/RunWorktreeSlot";
import type { SandboxAccess } from "./models/SandboxAccess";
import { isWorktreeRepo, snapshotOf } from "./repoSnapshot";
import { restoreTool } from "./restoreTool";
import { SandboxShellRoute } from "./SandboxShellRoute";
import { failure, noSandbox, resourceOf } from "./sandboxResults";
import { createSessionTools } from "./sessionTools";
import { syncTool } from "./syncTool";

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
// `deps.runWorktree`: where the runner tells the run's worktree when it commits code there; that repo is copied from it
// and sandbox_sync recopies it. Without the slot (a run with no worktree support) the repos come from the cache. With
// it, the run's worktree shell sends its builds and tests here too (`deps.runShellRoute`, SandboxShellRoute).
export function createSandboxTools(deps: AgentDeps, agent: AgentDefinition, context: OutsideAccessContext, repos: RepoAccess): ToolDefinition<any>[] {
  const isOn = agent.capabilities.integrations?.[SANDBOX_INTEGRATION] === true;

  if (!isOn || !deps.sandbox) {
    return [];
  }

  const access = deps.sandbox;
  const sandbox: RunSandbox = { info: null, repos: [], restored: [] };
  const ttlMinutes = agent.limits.timeoutMinutes + TTL_MARGIN_MINUTES;
  const worktree = deps.runWorktree ?? null;
  const open = openTool(deps, context, access, sandbox, repos, worktree, ttlMinutes);
  const restore = restoreTool(deps, context, access, sandbox);
  const sync = worktree ? [syncTool(deps, context, access, sandbox, worktree)] : [];

  if (worktree && deps.runShellRoute) {
    deps.runShellRoute.current = new SandboxShellRoute({ tools: { open, sync: sync[0], restore }, access, sandbox, worktree, outside: deps.outside, context, log: deps.runBuildLog ?? null }, access.buildCommands);
  }

  return [
    open,
    ...sync,
    restore,
    runCommandTool(deps, context, access, sandbox),
    ...createSessionTools(deps, context, access, sandbox),
    ...createEditTools(deps, context, access, sandbox),
    closeTool(deps, context, access, sandbox),
  ];
}

function openTool(deps: AgentDeps, context: OutsideAccessContext, access: SandboxAccess, sandbox: RunSandbox, repos: RepoAccess, worktree: RunWorktreeSlot | null, ttlMinutes: number) {
  return defineOutsideTool(deps.outside, context, {
    name: "sandbox_open",
    description: `Open your sandbox before any other sandbox tool: a Linux container with your repos copied in at /workspace/<repo> (each a git repo of its own at the run's commit), where you can build, run tests, grep and run scripts. It has no network: fetch the packages a build needs with sandbox_restore. Call it again to copy in more repos (open_repo first). Nothing you change leaves the sandbox: put what you found in your result.${worktreeNote(worktree)}`,
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

      const copied = await copyRepos(deps, access, sandbox, repos, worktree?.current ?? null, wanted.filter((name) => !sandbox.repos.includes(name)));

      return copied ?? { text: layoutText(sandbox, repos, worktree?.current ?? null), rows: sandbox.repos.length };
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

      recordBuildCommand(deps, access, input.command, answer);

      return answer.ok ? commandText(answer.value) : failure(answer);
    },
  });
}

// A build or test given to run_command counts like one from the worktree's shell.
function recordBuildCommand(deps: AgentDeps, access: SandboxAccess, command: string, answer: SandboxAnswer<CommandResult>): void {
  if (!deps.runBuildLog || !isSandboxBuildCommand(command, access.buildCommands)) {
    return;
  }

  recordBuildRun(deps.runBuildLog, command, answer.ok ? exitCodeOf(answer.value) : null, answer.ok ? null : answer.message);
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
      sandbox.restored = [];

      return answer.ok ? { text: "The sandbox is removed." } : failure(answer);
    },
  });
}

async function ensureOpen(access: SandboxAccess, sandbox: RunSandbox, owner: string, ttlMinutes: number): Promise<OutsideToolResult | null> {
  if (sandbox.info) {
    return null;
  }

  const answer = await access.client.open({ owner, ttlMinutes, image: access.image, packageCache: access.packageCache });

  if (!answer.ok) {
    return failure(answer);
  }

  sandbox.info = answer.value;

  return null;
}

function worktreeNote(worktree: RunWorktreeSlot | null): string {
  if (!worktree) {
    return "";
  }

  return ` If your run has a worktree, its own repo is copied from the worktree instead of the base commit (with what you committed and changed there); call sandbox_sync to bring later commits in. Edits you make with the sandbox's edit tools stay in the sandbox: change code in your worktree.`;
}

async function copyRepos(deps: AgentDeps, access: SandboxAccess, sandbox: RunSandbox, repos: RepoAccess, worktree: RunWorktree | null, names: string[]): Promise<OutsideToolResult | null> {
  for (const name of names) {
    const message = isWorktreeRepo(worktree, name) ? "your worktree" : `base ${repos.commits[name] ?? "unknown"}`;
    const answer = await access.client.uploadRepo(sandbox.info!.id, name, snapshotOf(deps.repoCache.root, worktree, name), message);

    if (!answer.ok) {
      return failure(answer);
    }

    sandbox.repos.push(name);
  }

  return null;
}

function layoutText(sandbox: RunSandbox, repos: RepoAccess, worktree: RunWorktree | null): string {
  const info = sandbox.info!;
  const lines = sandbox.repos.map((name) => `- ${info.workspace}/${name} (${sourceOf(repos, worktree, name)})`);
  const toolchains = info.toolchains ? `\nToolchains: ${info.toolchains}` : "";

  return `Sandbox ${info.id} is open until ${info.expiresAt}.\nRepos:\n${lines.join("\n") || "- none"}${toolchains}\nNo network (sandbox_restore fetches packages); Linux only (projects that need Windows don't build here). git status / git diff show your changes.`;
}

function sourceOf(repos: RepoAccess, worktree: RunWorktree | null, name: string): string {
  if (isWorktreeRepo(worktree, name)) {
    return "your worktree's files";
  }

  return `commit ${(repos.commits[name] ?? "unknown").slice(0, 12)}`;
}

function commandText(result: CommandResult): OutsideToolResult {
  const seconds = (result.durationMs / 1000).toFixed(1);
  const status = result.timedOut ? `Timed out after ${seconds} s and was killed` : `Exit code ${result.exitCode} (${seconds} s)`;

  return { text: `${status}\n${result.output}`, isError: result.timedOut, truncated: result.truncated };
}
