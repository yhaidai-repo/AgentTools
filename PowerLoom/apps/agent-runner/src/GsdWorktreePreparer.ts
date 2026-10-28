import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { promisify } from "node:util";
import { appendMissingExcludes, createPlanningFolder, disableCommitDocs } from "./gsdWorktreeFiles";
import type { GitIdentity } from "./models/GitIdentity";
import type { GsdWorktreeOptions } from "./models/GsdWorktreeOptions";

const run = promisify(execFile);

export const GSD_CORE_VERSION = "1.19.0";

const INSTALL_ARGS = ["--local", "--claude", "--relative-includes", "--no-legacy-cleanup"];

// Prepares a per-PBI git worktree for GSD before the first GSD command. Every step is local to the worktree and safe to repeat.
// The run must load the installer's hooks and permissions with settingSources: ["project", "local"]: the installer writes
// them to <worktree>/.claude/settings.local.json (not settings.json), which the "project" source alone never reads.
export class GsdWorktreePreparer {
  async prepare(options: GsdWorktreeOptions): Promise<void> {
    const worktree = resolve(options.worktree);

    await this.requirePinnedGsdCore(options.gsdCore);
    this.requireIdentity(options.identity);

    // Without its own .planning/, gsd-tools.cjs remaps every command to the MAIN checkout (resolveMainWorktreeCwd).
    const planning = await createPlanningFolder(worktree);

    // Keeps GSD from committing planning docs into the PBI branch.
    await disableCommitDocs(planning);
    await appendMissingExcludes(await this.excludeFileOf(worktree));
    await this.installGsd(worktree, options.gsdCore);
    await this.setIdentity(worktree, options.identity);
  }

  // `info/exclude` lives in the common git dir, so in a linked worktree this is the main repo's file, shared by all its
  // worktrees: .planning/ and .claude/ become untracked-and-ignored there too. The repo's .gitignore is never edited.
  private async excludeFileOf(worktree: string): Promise<string> {
    const path = (await this.git(worktree, ["rev-parse", "--git-path", "info/exclude"])).trim();

    return isAbsolute(path) ? path : join(worktree, path);
  }

  private async installGsd(worktree: string, gsdCore: string): Promise<void> {
    await run(process.execPath, [join(gsdCore, "bin", "install.js"), ...INSTALL_ARGS], { cwd: worktree });
  }

  private async setIdentity(worktree: string, identity: GitIdentity): Promise<void> {
    // Plain --local would write the shared repo config; --worktree keeps the identity to this worktree.
    await this.git(worktree, ["config", "extensions.worktreeConfig", "true"]);
    await this.git(worktree, ["config", "--worktree", "user.name", identity.name]);
    await this.git(worktree, ["config", "--worktree", "user.email", identity.email]);
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

  private async git(cwd: string, args: string[]): Promise<string> {
    const { stdout } = await run("git", args, { cwd });

    return stdout;
  }
}
