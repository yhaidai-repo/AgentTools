import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import type { PlanningFolder } from "./models/PlanningFolder";

const run = promisify(execFile);

// GSD's local install puts its tools here (GsdWorktreePreparer installs with --local --claude).
const GSD_TOOLS = join(".claude", "gsd-core", "bin", "gsd-tools.cjs");
const INSPECT_TIMEOUT_MS = 60_000;
const INSPECT_MAX_BUFFER = 20 * 1024 * 1024;

// The .planning/ folder of the run's worktree. `planning inspect` runs in the worktree itself: it has its own .planning/,
// so gsd-tools never remaps to the main checkout.
export class WorktreePlanningFolder implements PlanningFolder {
  constructor(private readonly worktree: string) {}

  async inspect(): Promise<unknown> {
    const { stdout } = await run(process.execPath, [join(this.worktree, GSD_TOOLS), "planning", "inspect"], { cwd: this.worktree, timeout: INSPECT_TIMEOUT_MS, maxBuffer: INSPECT_MAX_BUFFER });

    return JSON.parse(stdout);
  }

  async read(path: string): Promise<string | null> {
    try {
      return await readFile(join(this.worktree, ".planning", path), "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return null;
      }

      throw error;
    }
  }
}
