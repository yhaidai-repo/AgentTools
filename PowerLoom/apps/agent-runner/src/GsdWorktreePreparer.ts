import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { createPlanningFolder, disableCommitDocs, ignoreFolderContents } from "./gsdWorktreeFiles";
import type { GitIdentity } from "./models/GitIdentity";
import type { GitIdentityEnv } from "./models/GitIdentityEnv";
import type { GsdWorktreeOptions } from "./models/GsdWorktreeOptions";

const run = promisify(execFile);

export const GSD_CORE_VERSION = "1.19.0";

const INSTALL_ARGS = ["--local", "--claude", "--relative-includes", "--no-legacy-cleanup"];

// Prepares a per-PBI git worktree for GSD before the first GSD command. Every step is local to the worktree (nothing is
// written to the main repository's .git) and safe to repeat.
// The run must load the installer's hooks and permissions with settingSources: ["project", "local"]: the installer writes
// them to <worktree>/.claude/settings.local.json (not settings.json), which the "project" source alone never reads.
export class GsdWorktreePreparer {
  /** Returns the environment the run's processes need so GSD's commits carry the run's identity. */
  async prepare(options: GsdWorktreeOptions): Promise<GitIdentityEnv> {
    const worktree = resolve(options.worktree);

    await this.requirePinnedGsdCore(options.gsdCore);
    this.requireIdentity(options.identity);

    // Without its own .planning/, gsd-tools.cjs remaps every command to the MAIN checkout (resolveMainWorktreeCwd).
    const planning = await createPlanningFolder(worktree);

    // Keeps GSD from committing planning docs into the PBI branch.
    await disableCommitDocs(planning);

    // info/exclude is read from the shared git dir only, so a nested .gitignore is the per-worktree way. It does not
    // cover tracked files: a tracked .claude/CLAUDE.md is still committed when changed.
    await ignoreFolderContents(planning);
    await ignoreFolderContents(join(worktree, ".claude"));
    await this.installGsd(worktree, options.gsdCore);

    return identityEnv(options.identity);
  }

  private async installGsd(worktree: string, gsdCore: string): Promise<void> {
    await run(process.execPath, [join(gsdCore, "bin", "install.js"), ...INSTALL_ARGS], { cwd: worktree });
  }

  private requireIdentity(identity: GitIdentity): void {
    if (!identity.name.trim() || !identity.email.trim()) {
      throw new Error("The run's commit identity needs a name and an email.");
    }
  }

  private async requirePinnedGsdCore(gsdCore: string): Promise<void> {
    const manifest = JSON.parse(await readFile(join(gsdCore, "package.json"), "utf8")) as { version?: string };

    if (manifest.version !== GSD_CORE_VERSION) {
      throw new Error(`@opengsd/gsd-core ${GSD_CORE_VERSION} is required, found ${manifest.version ?? "unknown"} in ${gsdCore}.`);
    }
  }
}

export function identityEnv({ name, email }: GitIdentity): GitIdentityEnv {
  return { GIT_AUTHOR_NAME: name, GIT_AUTHOR_EMAIL: email, GIT_COMMITTER_NAME: name, GIT_COMMITTER_EMAIL: email };
}
