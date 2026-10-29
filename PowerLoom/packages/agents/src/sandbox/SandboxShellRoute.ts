import type { ShellRoute, ShellRouted } from "@agenttools/runtime";
import type { CommandResult, SandboxAnswer } from "@powerloom/sandbox";
import type { OutsideToolResult } from "../models/OutsideToolResult";
import { recordOutsideCall } from "../outsideAccess";
import { isSandboxBuildCommand } from "./buildRouting";
import type { RunWorktree } from "./models/RunWorktree";
import type { SandboxRouteParts } from "./models/SandboxRouteParts";
import { failureDigestCommand, routedText } from "./routedOutput";
import { sandboxFolderOf, withSandboxPaths } from "./routedPaths";
import { resourceOf } from "./sandboxResults";

// A build may run as long as the sandbox lets a command run; a shorter timeout from the call is raised to this.
const ROUTED_TIMEOUT_MS = 600_000;
const DIGEST_TIMEOUT_MS = 60_000;
const REQUEST_CHARS = 500;
// The exit code a shell gives a command killed by `timeout`.
const TIMED_OUT_EXIT_CODE = 124;
const FAILED_EXIT_CODE = 1;

// The worktree shell's builds and tests, run in the run's sandbox (user decision 2026-10-29): GSD's executors and
// verifier are sub-agents with only the shell, so a build or test command they give (buildRouting) runs on a fresh
// sync of the worktree and comes back as the shell's result, failure lines included. One at a time: a sync replaces the
// repo's folder, which a build running beside it would lose. The first one opens the sandbox and restores the repo's
// packages when nothing has yet.
export class SandboxShellRoute implements ShellRoute {
  private turn: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly parts: SandboxRouteParts,
    private readonly buildCommands: string[],
  ) {}

  run(command: string, cwd: string, timeoutMs: number | null): Promise<ShellRouted | null> {
    const worktree = this.parts.worktree.current;

    if (!worktree || !isSandboxBuildCommand(command, this.buildCommands)) {
      return Promise.resolve(null);
    }

    return this.inTurn(() => this.runInSandbox(worktree, command, cwd, timeoutMs));
  }

  private inTurn<T>(step: () => Promise<T>): Promise<T> {
    const next = this.turn.catch(() => undefined).then(step);

    this.turn = next;

    return next;
  }

  private async runInSandbox(worktree: RunWorktree, command: string, cwd: string, timeoutMs: number | null): Promise<ShellRouted> {
    const ready = await this.freshCopy(worktree);

    if (!ready.ok) {
      return { exitCode: FAILED_EXIT_CODE, output: `The build or test could not run in the run's sandbox: ${ready.reason}` };
    }

    const repoFolder = `${this.parts.sandbox.info!.workspace}/${worktree.repo}`;
    const folder = sandboxFolderOf(worktree.path, cwd, repoFolder);
    const sandboxCommand = withSandboxPaths(command, worktree.path, repoFolder);
    const answer = await this.loggedRun(sandboxCommand, folder, Math.max(timeoutMs ?? 0, ROUTED_TIMEOUT_MS));

    if (!answer.ok) {
      return { exitCode: FAILED_EXIT_CODE, output: `The build or test could not run in the run's sandbox: ${answer.message}` };
    }

    return { exitCode: exitCodeOf(answer.value), output: routedText(folder, answer.value, ready.notes, await this.failureDigest(answer.value)) };
  }

  // The sandbox with the worktree's current files: opened (which copies them) or synced, and its packages restored once.
  private async freshCopy(worktree: RunWorktree): Promise<{ ok: true; notes: string[] } | { ok: false; reason: string }> {
    const { tools, sandbox } = this.parts;
    const isCopied = sandbox.info !== null && sandbox.repos.includes(worktree.repo);
    const copied = isCopied ? await tools.sync.handler({}) : await tools.open.handler({ repos: [worktree.repo] });

    if (copied.isError) {
      return { ok: false, reason: copied.text };
    }

    return { ok: true, notes: await this.restoreOnce(worktree.repo) };
  }

  // A failed restore doesn't stop the build: the vault's cache may hold the packages already, and the build says what's
  // missing. Only the first lines of the restore's answer go into the note.
  private async restoreOnce(repo: string): Promise<string[]> {
    if (this.parts.sandbox.restored.includes(repo)) {
      return [];
    }

    const restored = await this.parts.tools.restore.handler({ repo });

    return restored.isError ? [`The package restore before it did not fully succeed: ${restored.text.split("\n").slice(0, 3).join(" ")}`] : [];
  }

  // Every sandbox call goes to the data access log, as run_command's do.
  private async loggedRun(command: string, cwd: string, timeoutMs: number): Promise<SandboxAnswer<CommandResult>> {
    const { access, sandbox, outside, context } = this.parts;
    const startedAt = new Date();
    const answer = await access.client.run(sandbox.info!.id, { command, cwd, timeoutMs });
    const result: OutsideToolResult = answer.ok ? { text: answer.value.output, truncated: answer.value.truncated } : { text: answer.message, isError: true };

    await recordOutsideCall(outside, context, { tool: "run_command", resource: resourceOf(access, sandbox, cwd), request: command.slice(0, REQUEST_CHARS), result, startedAt });

    return answer;
  }

  // A failed command whose output was cut gets its failure lines from the whole output, so a verifier sees every one.
  private async failureDigest(result: CommandResult): Promise<string | null> {
    if (!result.truncated || result.exitCode === 0) {
      return null;
    }

    const digest = await this.loggedRun(failureDigestCommand(result.outputFile), this.parts.sandbox.info!.workspace, DIGEST_TIMEOUT_MS);

    return digest.ok && digest.value.output.trim().length > 0 ? digest.value.output : null;
  }
}

function exitCodeOf(result: CommandResult): number {
  return result.timedOut || result.exitCode === null ? TIMED_OUT_EXIT_CODE : result.exitCode;
}
