import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { scopedFilePath } from "@powerloom/vault";
import type { RepoCache } from "@agenttools/runtime";
import type { GitHubRepoTarget } from "./models/GitHubRepoTarget";
import type { WorkCopy } from "./models/WorkCopy";

const AUTHOR_EMAIL = "powerloom-agent@users.noreply.github.com";

// GitHub (write) (user decision 2026-10-25): a run's working copies, one per repo, each on a branch of its own
// (powerloom/<task>-r<run>, from the repo's default branch) in a worktree beside the shared checkouts, removed when the
// run ends; what was pushed stays on GitHub. Only that branch is ever committed to and pushed.
export class GitHubWorkspace {
  private readonly copies = new Map<string, WorkCopy>();
  private readonly starting = new Map<string, Promise<{ copy: WorkCopy; baseCommit: string | null }>>();

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

    const name = key(target.name);
    const pending = this.starting.get(name);
    if (pending) return pending;
    const current = this.startCopy(target);
    this.starting.set(name, current);
    try { return await current; }
    finally { this.starting.delete(name); }
  }

  private async startCopy(target: GitHubRepoTarget): Promise<{ copy: WorkCopy; baseCommit: string | null }> {
    await this.cache.acquire([target.ref]);

    const copy: WorkCopy = { target, path: join(this.cache.root, ".work", `run-${this.runId}`, target.ref.name), branch: this.branch, base: target.ref.defaultBranch, pushed: false };
    try {
      const baseCommit = await this.cache.checkoutNewBranch(target.ref, copy.base, copy.branch, copy.path);
      this.copies.set(key(target.name), copy);
      return { copy, baseCommit };
    } catch (error) {
      try { await this.cache.removeCheckout(target.ref, copy.path); }
      catch (cleanupError) { console.error("GitHub branch setup cleanup failed:", cleanupError); }
      finally { this.cache.release([target.ref]); }
      throw error;
    }
  }

  copyOf(repo: string): WorkCopy | null {
    return this.copies.get(key(repo)) ?? null;
  }

  async read(copy: WorkCopy, path: string): Promise<string> {
    return readFile(await this.fileOf(copy, path), "utf8");
  }

  async write(copy: WorkCopy, path: string, content: string): Promise<void> {
    const file = await this.fileOf(copy, path);

    await mkdir(dirname(file), { recursive: true });
    await this.fileOf(copy, path);
    await writeFile(file, content, "utf8");
  }

  async remove(copy: WorkCopy, path: string): Promise<void> {
    await rm(await this.fileOf(copy, path));
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
    await Promise.allSettled(this.starting.values());
    const failures: unknown[] = [];
    for (const [name, copy] of this.copies) {
      this.copies.delete(name);
      try { await this.cache.removeCheckout(copy.target.ref, copy.path); }
      catch (error) { failures.push(error); }
      finally { this.cache.release([copy.target.ref]); }
    }
    if (failures.length) throw new AggregateError(failures, "GitHub working-copy cleanup failed.");
  }

  // A path inside the working copy, never its .git: a path that would leave it is refused.
  private async fileOf(copy: WorkCopy, path: string): Promise<string> {
    try {
      const file = await scopedFilePath(copy.path, path);
      const metadata = [relative(resolve(copy.path), file.path), relative(file.root, file.canonical)].some((inner) => inner.split(/[\\/]/).some((part) => {
        const normalized = process.platform === "win32" ? part.replace(/[. ]+$/g, "").split(":")[0] : part;
        return normalized.toLowerCase() === ".git";
      }));
      if (metadata) throw new Error("Git metadata is not writable through working-copy tools.");
      return file.path;
    } catch (error) {
      throw new Error(`${path} isn't a file of the working copy.`, { cause: error });
    }
  }
}

function key(repo: string): string {
  return repo.trim().toLowerCase();
}

function slug(text: string): string {
  return text.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-").replaceAll(/^-|-$/g, "");
}
