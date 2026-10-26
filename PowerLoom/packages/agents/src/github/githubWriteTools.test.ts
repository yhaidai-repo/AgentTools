import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import type { AgentDefinition } from "@agenttools/config";
import { RepoCache } from "@agenttools/runtime";
import type { AgentDeps } from "../models/AgentDeps";
import type { DataAccessEntry } from "../models/DataAccessEntry";
import { createGitHubWriteTools } from "./githubWriteTools";
import { GitHubWorkspace } from "./GitHubWorkspace";

const context = { vault: "work", agentId: "dev", runId: 7, owner: "powerloom-run-7", taskId: "AT-1-001", pbiId: 1 };
const agent = { label: "Dev", capabilities: { integrations: { githubWrite: true } } } as unknown as AgentDefinition;

// A bare repo stands in for GitHub: main has one commit; the catalog names it `app` of koffcheg.
function setUp() {
  const root = mkdtempSync(join(tmpdir(), "github-write-"));
  const remote = join(root, "remote.git");
  const seed = join(root, "seed");
  const git = (args: string[], cwd?: string) => execFileSync("git", args, { cwd, stdio: "pipe" }).toString().trim();

  git(["init", "--quiet", "--bare", "-b", "main", remote]);
  git(["clone", "--quiet", remote, seed]);
  writeFileSync(join(seed, "a.txt"), "one\ntwo\n");
  git(["add", "."], seed);
  git(["-c", "user.name=t", "-c", "user.email=t@t", "commit", "--quiet", "-m", "base"], seed);
  git(["push", "--quiet", "origin", "HEAD:main"], seed);

  const row = { name: "app", kind: "github", adoProject: "koffcheg", remoteUrl: remote, defaultBranch: "main" };
  const db = { select: () => ({ from: () => ({ where: () => ({ orderBy: async () => [row] }) }) }) };
  const opened: unknown[] = [];
  const entries: DataAccessEntry[] = [];
  const api = { createDraftPullRequest: async (owner: string, repo: string, pull: unknown) => (opened.push({ owner, repo, pull }), { number: 12, html_url: "https://github.com/koffcheg/app/pull/12" }) };
  const cache = new RepoCache({ root: join(root, "cache"), refreshMinutes: 30 });
  const deps = { db, repoCache: cache, github: { api, login: "koffcheg" }, outside: { log: { record: async (entry: DataAccessEntry) => { entries.push(entry); } }, requests: { request: async () => ({ id: "HT-1", created: true }) } } } as unknown as AgentDeps;
  const workspace = new GitHubWorkspace(cache, 7, "AT-1-001", "PowerLoom (Dev)");
  const tools = Object.fromEntries(createGitHubWriteTools(deps, agent, context, workspace).map((tool) => [tool.name, tool]));

  return { remote, git, tools, workspace, opened, entries };
}

describe("the GitHub write tools", () => {
  it("change the repo on the run's own branch, push only it and open a draft pull request into the default branch", async () => {
    const { remote, git, tools, workspace, opened, entries } = setUp();

    const early = await tools.github_write_file.handler({ repo: "app", path: "a.txt", content: "x" });
    await tools.github_start_branch.handler({ repo: "app" });
    await tools.github_edit_file.handler({ repo: "app", path: "a.txt", find: "two", replace: "TWO" });
    await tools.github_write_file.handler({ repo: "app", path: "src/b.txt", content: "new\n" });
    const outside = await tools.github_write_file.handler({ repo: "app", path: "../escape.txt", content: "x" });
    const diff = await tools.github_diff.handler({ repo: "app" });
    const notPushed = await tools.github_open_pull_request.handler({ repo: "app", title: "t", body: "b" });
    await tools.github_commit.handler({ repo: "app", message: "Shout two, add b" });
    await tools.github_push.handler({ repo: "app" });
    const pull = await tools.github_open_pull_request.handler({ repo: "app", title: "Shout two", body: "Why." });
    const path = workspace.copyOf("app")!.path;
    await workspace.cleanUp();

    assert.match(early.text, /Start the branch first/);
    assert.match(outside.text, /isn't a file of the working copy/);
    assert.match(diff.text, /\+TWO/);
    assert.match(diff.text, /src\/b\.txt/);
    assert.match(notPushed.text, /Push the branch first/);
    assert.equal(git(["--git-dir", remote, "log", "--format=%an: %s", "-1", "powerloom/at-1-001-r7"]), "PowerLoom (Dev): Shout two, add b");
    assert.equal(git(["--git-dir", remote, "rev-list", "--count", "main"]), "1");
    assert.deepEqual(opened, [{ owner: "koffcheg", repo: "app", pull: { title: "Shout two", body: "Why.", head: "powerloom/at-1-001-r7", base: "main" } }]);
    assert.match(pull.text, /#12: https:\/\/github.com\/koffcheg\/app\/pull\/12/);
    assert.equal(existsSync(path), false);
    assert.ok(entries.every((entry) => entry.kind === "github"));
  });

  it("refuses a repo the vault doesn't have and gives nothing without the switch", async () => {
    const { tools } = setUp();
    const off = { capabilities: { integrations: {} } } as unknown as AgentDefinition;

    const unknown = await tools.github_start_branch.handler({ repo: "other" });

    assert.match(unknown.text, /isn't an enabled GitHub repo/);
    assert.deepEqual(createGitHubWriteTools({ github: {} } as unknown as AgentDeps, off, context, null), []);
  });
});
