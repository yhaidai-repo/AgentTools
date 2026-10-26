import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { RepoCache } from "./RepoCache";

const author = { name: "PowerLoom agent", email: "agent@powerloom.local" };

// A bare "remote" with one commit on main, and a cache that cloned it.
function remoteWithMain(): { remote: string; root: string } {
  const root = mkdtempSync(join(tmpdir(), "repo-writes-"));
  const remote = join(root, "remote.git");
  const seed = join(root, "seed");
  const git = (args: string[], cwd?: string) => execFileSync("git", args, { cwd, stdio: "pipe" });

  git(["init", "--quiet", "--bare", "-b", "main", remote]);
  git(["clone", "--quiet", remote, seed]);
  writeFileSync(join(seed, "a.txt"), "one\n");
  git(["add", "."], seed);
  git(["-c", "user.name=t", "-c", "user.email=t@t", "commit", "--quiet", "-m", "base"], seed);
  git(["push", "--quiet", "origin", "HEAD:main"], seed);

  return { remote, root };
}

describe("RepoCache writes", () => {
  it("starts a branch from the remote's base, commits in its own worktree and pushes only that branch", async () => {
    const { remote, root } = remoteWithMain();
    const cache = new RepoCache({ root: join(root, "cache"), refreshMinutes: 30 });
    const repo = { name: "app", remoteUrl: remote, defaultBranch: "main" };
    const work = join(root, "work", "app");

    await cache.acquire([repo]);
    const base = await cache.checkoutNewBranch(repo, "main", "powerloom/at-1-001-r7", work);
    writeFileSync(join(work, "a.txt"), "two\n");
    writeFileSync(join(work, "b.txt"), "new\n");
    const diff = await cache.workingDiff(work);
    const commit = await cache.commitAll(work, "Change a, add b", author);
    const nothing = await cache.commitAll(work, "again", author);
    await cache.pushBranch(work, "powerloom/at-1-001-r7");

    const pushed = execFileSync("git", ["--git-dir", remote, "log", "--format=%H %an %s", "-1", "powerloom/at-1-001-r7"]).toString().trim();
    const main = execFileSync("git", ["--git-dir", remote, "rev-parse", "main"]).toString().trim();

    assert.match(diff, /\+two/);
    assert.match(diff, /b\.txt/);
    assert.equal(pushed, `${commit} PowerLoom agent Change a, add b`);
    assert.equal(nothing, null);
    assert.equal(main, base);
    assert.equal(readFileSync(join(root, "cache", "app", "a.txt"), "utf8"), "one\n");
  });
});
