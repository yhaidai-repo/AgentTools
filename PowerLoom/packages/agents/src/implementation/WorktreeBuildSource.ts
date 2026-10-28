import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { BuildCommit } from "@powerloom/db";
import { WorktreePlanningFolder } from "../planning/WorktreePlanningFolder";
import type { PlanningFolder } from "../planning/models/PlanningFolder";
import type { BuildSource } from "./models/BuildSource";

const run = promisify(execFile);

const GIT_TIMEOUT_MS = 60_000;
const GIT_MAX_BUFFER = 20 * 1024 * 1024;
const FIELD = "\u001f";

// The run's worktree as write_implementation reads it: GSD's .planning/ folder and the branch's local commits. Only local
// refs are read; nothing is fetched.
export class WorktreeBuildSource implements BuildSource {
  readonly planning: PlanningFolder;

  constructor(private readonly worktree: string) {
    this.planning = new WorktreePlanningFolder(worktree);
  }

  async commits(base: string): Promise<BuildCommit[]> {
    const log = await this.git(["log", "--reverse", `--format=%H${FIELD}%s`, `origin/${base}..HEAD`]);

    return log.split(/\r?\n/).filter(Boolean).map(commitOf);
  }

  async head(): Promise<string | null> {
    return (await this.git(["rev-parse", "HEAD"])).trim() || null;
  }

  private async git(args: string[]): Promise<string> {
    const { stdout } = await run("git", args, { cwd: this.worktree, timeout: GIT_TIMEOUT_MS, maxBuffer: GIT_MAX_BUFFER });

    return stdout;
  }
}

function commitOf(line: string): BuildCommit {
  const [sha, message] = line.split(FIELD);

  return { sha, message: message ?? "" };
}
