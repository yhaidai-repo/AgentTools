import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AgentDefinition } from "@agenttools/config";
import type { AgentDeps } from "../models/AgentDeps";
import type { DataAccessEntry } from "../models/DataAccessEntry";
import { GitHubApiError } from "./GitHubApiError";
import { createGitHubReadTools } from "./githubReadTools";

const context = { vault: "work", agentId: "dev", runId: 7, owner: "powerloom-run-7", taskId: "AT-1-001", pbiId: 1 };
const agent = { capabilities: { integrations: { githubRead: true } } } as unknown as AgentDefinition;
const row = { name: "app", kind: "github", adoProject: "koffcheg", remoteUrl: "https://github.com/koffcheg/app.git", defaultBranch: "main" };

function setUp(api: Record<string, unknown>) {
  const entries: DataAccessEntry[] = [];
  const db = { select: () => ({ from: () => ({ where: () => ({ orderBy: async () => [row] }) }) }) };
  const deps = { db, github: { api, login: "koffcheg" }, outside: { log: { record: async (entry: DataAccessEntry) => { entries.push(entry); } }, requests: { request: async () => ({ id: "HT-1-001", created: true }) } } } as unknown as AgentDeps;

  return { tools: Object.fromEntries(createGitHubReadTools(deps, agent, context).map((tool) => [tool.name, tool])), entries };
}

describe("the GitHub read tools", () => {
  it("read a pull request with its files, reviews and comments, and CI checks", async () => {
    const pull = { number: 5, title: "Fix payers", state: "open", draft: false, user: { login: "kim" }, head: { ref: "fix", sha: "abcdef123456" }, base: { ref: "main" }, body: "Why", html_url: "https://github.com/koffcheg/app/pull/5" };
    const { tools, entries } = setUp({
      pullRequest: async () => ({ pull, files: [{ filename: "a.cs", status: "modified", additions: 3, deletions: 1 }], reviews: [{ user: { login: "sam" }, state: "CHANGES_REQUESTED", body: "Rename it" }], reviewComments: [{ user: { login: "sam" }, path: "a.cs", line: 4, body: "here" }], comments: [] }),
      checks: async () => ({ runs: [{ name: "build", status: "completed", conclusion: "failure" }], status: { state: "failure", statuses: [] } }),
    });

    const read = await tools.github_pull_request.handler({ repo: "app", number: 5 });
    const checks = await tools.github_checks.handler({ repo: "app", ref: "fix" });

    assert.match(read.text, /#5 Fix payers · open · by kim · fix \(abcdef12\) → main/);
    assert.match(read.text, /- a\.cs \(modified, \+3 -1\)/);
    assert.match(read.text, /- sam: CHANGES_REQUESTED: Rename it/);
    assert.match(read.text, /- sam on a\.cs:4: here/);
    assert.match(checks.text, /combined status failure[\s\S]*- build: completed \(failure\)/);
    assert.deepEqual(entries.map((entry) => [entry.kind, entry.resource, entry.target]), [["github", "app", "#5"], ["github", "app", "fix"]]);
  });

  it("asks the user to fix a refused token, but a rate limit is only a failure", async () => {
    const refused = setUp({ issues: async () => { throw new GitHubApiError(401, "GitHub answered 401"); } });
    const limited = setUp({ issues: async () => { throw new GitHubApiError(403, "GitHub answered 403", true); } });

    const denied = await refused.tools.github_issues.handler({ repo: "app", state: "open" });
    await limited.tools.github_issues.handler({ repo: "app", state: "open" });

    assert.match(denied.text, /Task HT-1-001 asks a person to fix it/);
    assert.equal(refused.entries[0].outcome, "denied");
    assert.equal(limited.entries[0].outcome, "failed");
  });
});
