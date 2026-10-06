import { access, rm } from "node:fs/promises";
import { join } from "node:path";
import type { PullRequestCheckout } from "../models/PullRequestCheckout";
import type { PullRequestRef } from "../models/PullRequestRef";
import type { RepoCacheOptions } from "../models/RepoCacheOptions";
import type { RepoProgress } from "../models/RepoProgress";
import type { RepoRef } from "../models/RepoRef";
import { git } from "./git";

// One checkout per repo, cloned once and refreshed at most every `refreshMinutes`.
// A repo in use by a run is never refreshed under it; read-only agents share the checkout.
export class RepoCache {
  private readonly lastFetch = new Map<string, number>();
  private readonly inUse = new Map<string, number>();

  constructor(private readonly options: RepoCacheOptions) {}

  /** Clones or refreshes the repos, marks them in use, and returns their current commits. Reports each repo.
   *  `refreshMinutes` lets one agent refresh more or less often than the cache default. */
  async acquire(repos: RepoRef[], onProgress?: (progress: RepoProgress) => Promise<void>, refreshMinutes = this.options.refreshMinutes): Promise<Record<string, string>> {
    const commits: Record<string, string> = {};
    const acquired: RepoRef[] = [];

    // On a failure the repos taken so far are released, so a failed run never pins them.
    try {
      for (const repo of repos) {
        const progress = await this.acquireOne(repo, refreshMinutes);

        acquired.push(repo);
        commits[repo.name] = progress.commit;
        await onProgress?.(progress);
      }
    } catch (error) {
      this.release(acquired);
      throw error;
    }

    return commits;
  }

  /** Fetches a pull request's branches into the repo's cached clone (acquire the repo first) and checks the PR's source
   *  commit out as a separate worktree at `path`, so the shared default-branch checkout stays as it is. */
  async checkoutPullRequest(repo: RepoRef, pr: PullRequestRef, path: string): Promise<PullRequestCheckout> {
    const cwd = this.path(repo);
    const sourceRef = `refs/adoa/pr/${pr.id}/source`;
    const targetRef = `refs/adoa/pr/${pr.id}/target`;

    await this.git(["fetch", "origin", `+${pr.sourceRef}:${sourceRef}`, `+${pr.targetRef}:${targetRef}`], cwd, true);

    const sourceCommit = (await this.git(["rev-parse", sourceRef], cwd)).trim();
    const targetCommit = (await this.git(["rev-parse", targetRef], cwd)).trim();
    const mergeBase = (await this.git(["merge-base", targetCommit, sourceCommit], cwd)).trim();

    await rm(path, { recursive: true, force: true });
    // A partial clone downloads the files it checks out, hence the auth.
    await this.git(["worktree", "add", "--detach", "--force", path, sourceCommit], cwd, true);

    return { path, sourceCommit, targetCommit, mergeBase };
  }

  /** A unified diff between two commits of the repo, optionally limited to `paths`. File contents of a partial clone are
   *  downloaded on demand, hence the auth. */
  diff(repo: RepoRef, base: string, head: string, paths: string[] = []): Promise<string> {
    return this.git(["diff", "--no-color", "--no-ext-diff", "--find-renames", "--unified=3", base, head, "--", ...paths], this.path(repo), true);
  }

  /** Removes a worktree made by checkoutPullRequest; also when git no longer knows it (e.g. after a crash). */
  async removeCheckout(repo: RepoRef, path: string): Promise<void> {
    const cwd = this.path(repo);

    await this.git(["worktree", "remove", "--force", path], cwd).catch(() => "");
    await rm(path, { recursive: true, force: true });
    await this.git(["worktree", "prune"], cwd);
  }

  release(repos: RepoRef[]): void {
    repos.forEach((repo) => this.inUse.set(repo.name, Math.max(0, (this.inUse.get(repo.name) ?? 1) - 1)));
  }

  private async acquireOne(repo: RepoRef, refreshMinutes: number): Promise<RepoProgress> {
    const started = Date.now();
    const action = await this.ensure(repo, refreshMinutes);

    this.inUse.set(repo.name, (this.inUse.get(repo.name) ?? 0) + 1);

    const commit = (await this.git(["rev-parse", "HEAD"], this.path(repo))).trim();

    return { repo: repo.name, action, durationMs: Date.now() - started, commit };
  }

  private async ensure(repo: RepoRef, refreshMinutes: number): Promise<RepoProgress["action"]> {
    const isCloned = await this.isHealthyCheckout(repo);

    if (!isCloned) {
      await this.clone(repo);

      return "clone";
    }

    if (!this.isRefreshDue(repo, refreshMinutes)) {
      return "reuse";
    }

    await this.refresh(repo);

    return "refresh";
  }

  // A clone interrupted half-way leaves a .git without commits; it is removed and cloned again.
  private async isHealthyCheckout(repo: RepoRef): Promise<boolean> {
    if (!(await exists(join(this.path(repo), ".git")))) {
      return false;
    }

    const hasHead = await this.git(["rev-parse", "--verify", "HEAD"], this.path(repo)).then(() => true, () => false);

    if (!hasHead) {
      await rm(this.path(repo), { recursive: true, force: true });
    }

    return hasHead;
  }

  private async clone(repo: RepoRef): Promise<void> {
    // Partial clone: full history for git_log, file contents only for the checked-out version.
    await this.git(["clone", "--filter=blob:none", "--single-branch", "--branch", repo.defaultBranch, repo.remoteUrl, this.path(repo)], undefined, true);
    this.lastFetch.set(repo.name, Date.now());
  }

  private async refresh(repo: RepoRef): Promise<void> {
    await this.git(["fetch", "origin", repo.defaultBranch], this.path(repo), true);
    // A partial clone downloads the files the reset changes, hence the auth.
    await this.git(["reset", "--hard", `origin/${repo.defaultBranch}`], this.path(repo), true);
    this.lastFetch.set(repo.name, Date.now());
  }

  private isRefreshDue(repo: RepoRef, refreshMinutes: number): boolean {
    const isIdle = (this.inUse.get(repo.name) ?? 0) === 0;
    const age = Date.now() - (this.lastFetch.get(repo.name) ?? 0);

    return isIdle && age >= refreshMinutes * 60_000;
  }

  private git(args: string[], cwd?: string, needsAuth = false): Promise<string> {
    return git(args, cwd, needsAuth ? this.options.authHeader : undefined, (this.options.gitTimeoutMinutes ?? 15) * 60_000);
  }

  private path(repo: RepoRef): string {
    return join(this.options.root, repo.name);
  }
}

async function exists(path: string): Promise<boolean> {
  return access(path).then(() => true, () => false);
}
