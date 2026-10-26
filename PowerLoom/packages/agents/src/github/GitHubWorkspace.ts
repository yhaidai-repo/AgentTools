import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import type { RepoCache } from "@agenttools/runtime";
import type { GitHubRepoTarget } from "./models/GitHubRepoTarget";
import type { WorkCopy } from "./models/WorkCopy";

const AUTHOR_EMAIL = "powerloom-agent@users.noreply.github.com";

// GitHub (write) (user decision 2026-10-25): a run's working copies, one per repo, each on a branch of its own
// (powerloom/<task>-r<run>, from the repo's default branch) in a worktree beside the shared checkouts, removed when the
// run ends; what was pushed stays on GitHub. Only that branch is ever committed to and pushed.
export class GitHubWorkspace {
  private readonly copies = new Map<string, WorkCopy>();

  constructor(private readonly cache: RepoCache, private readonly runId: number, private readonly taskId: string | null, private readonly author: string) {}

  get branch(): string {
    return `powerloom/${slug(this.taskId ?? "run")}-r${this.runId}`;
  }

  /** The repo's working copy, started now if this run has none yet. */
  async start(target: GitHubRepoTarget): Promise<{ copy: WorkCopy; baseCommit: string | null }> {
    const known = this.copies.get(key(target.name));

    if (known) {
      return { copy: known, baseCommit: null };
    }

    await this.cache.acquire([target.ref]);

    const copy: WorkCopy = { target, path: join(this.cache.root, ".work", `run-${this.runId}`, target.ref.name), branch: this.branch, base: target.ref.defaultBranch, pushed: false };
    const baseCommit = await this.cache.checkoutNewBranch(target.ref, copy.base, copy.branch, copy.path);

    this.copies.set(key(target.name), copy);

    return { copy, baseCommit };
  }

  copyOf(repo: string): WorkCopy | null {
    return this.copies.get(key(repo)) ?? null;
  }

  async read(copy: WorkCopy, path: string): Promise<string> {
    return readFile(this.fileOf(copy, path), "utf8");
  }

  async write(copy: WorkCopy, path: string, content: string): Promise<void> {
    const file = this.fileOf(copy, path);

    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, content, "utf8");
  }

  async remove(copy: WorkCopy, path: string): Promise<void> {
    await rm(this.fileOf(copy, path));
  }

  diff(copy: WorkCopy): Promise<string> {
    return this.cache.workingDiff(copy.path);
  }

  commit(copy: WorkCopy, message: string): Promise<string | null> {
    return this.cache.commitAll(copy.path, message, { name: this.author, email: AUTHOR_EMAIL });
  }

  async push(copy: WorkCopy): Promise<void> {
    await this.cache.pushBranch(copy.path, copy.branch);
    copy.pushed = true;
  }

  /** Removes the worktrees and lets the repos go; what was pushed stays on GitHub. */
  async cleanUp(): Promise<void> {
    for (const copy of this.copies.values()) {
      await this.cache.removeCheckout(copy.target.ref, copy.path);
      this.cache.release([copy.target.ref]);
    }

    this.copies.clear();
  }

  // A path inside the working copy, never its .git: a path that would leave it is refused.
  private fileOf(copy: WorkCopy, path: string): string {
    const file = resolve(copy.path, path);
    const inside = relative(copy.path, file);

    if (inside === "" || inside.startsWith("..") || inside.split(sep)[0] === ".git") {
      throw new Error(`${path} isn't a file of the working copy.`);
    }

    return file;
  }
}

function key(repo: string): string {
  return repo.trim().toLowerCase();
}

function slug(text: string): string {
  return text.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-").replaceAll(/^-|-$/g, "");
}
