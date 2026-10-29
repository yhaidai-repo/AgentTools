import assert from "node:assert/strict";
import { join } from "node:path";
import { describe, it } from "node:test";
import type { RunShellRouteSlot, RunWorktreeSlot } from "@powerloom/agents";
import type { AgentEvent, AgentRequest, AgentRuntime, RepoRef } from "@agenttools/runtime";
import type { GitIdentityEnv } from "./models/GitIdentityEnv";
import type { GsdWorktreeOptions } from "./models/GsdWorktreeOptions";
import type { WorkspaceRepos } from "./models/WorkspaceRepos";
import { WorkspaceResolver } from "./WorkspaceResolver";
import { WorkspaceRuntime } from "./WorkspaceRuntime";

const ROOT = join("D:", "cache", ".worktrees", "vault");
const repo: RepoRef = { name: "app", remoteUrl: "https://dev.azure.com/org/app", defaultBranch: "main" };
const identity = { name: "PowerLoom agent", email: "agent@powerloom.local" };
const gsdEnv: GitIdentityEnv = { GIT_AUTHOR_NAME: "gsd", GIT_AUTHOR_EMAIL: "gsd@x", GIT_COMMITTER_NAME: "gsd", GIT_COMMITTER_EMAIL: "gsd@x" };
const worktree = join(ROOT, "app", "feature-123-totals");

// Records what the resolver asks of the repo cache; `failOpen` makes opening the worktree fail.
class FakeRepos implements WorkspaceRepos {
  readonly calls: string[] = [];

  constructor(private readonly failOpen = false) {}

  async acquire(repos: RepoRef[]): Promise<Record<string, string>> {
    this.calls.push(`acquire ${repos.map((entry) => entry.name).join()}`);

    return { app: "abc" };
  }

  release(repos: RepoRef[]): void {
    this.calls.push(`release ${repos.map((entry) => entry.name).join()}`);
  }

  async openBranchWorktree(entry: RepoRef, base: string, branch: string, path: string): Promise<void> {
    this.calls.push(`open ${entry.name} ${base} ${branch} ${path}`);

    if (this.failOpen) {
      throw new Error("fetch failed");
    }
  }
}

class FakeGsd {
  readonly prepared: GsdWorktreeOptions[] = [];

  async prepare(options: GsdWorktreeOptions): Promise<GitIdentityEnv> {
    this.prepared.push(options);

    return gsdEnv;
  }
}

function request(fields: Partial<AgentRequest> = {}): AgentRequest {
  return { runId: "run-1", model: { provider: "anthropic", model: "claude-opus-5-5", effort: "high" }, systemPrompt: "system", firstMessage: "hello", tools: [], limits: { maxTurns: 10, timeoutMs: 2000 }, ...fields };
}

function workspaceRequest(gsd: boolean): AgentRequest {
  return request({ env: { KEEP: "1" }, settingSources: ["project"], workspace: { repo, branch: "feature/123-totals", baseBranch: "develop", gsd } });
}

function resolver(repos: WorkspaceRepos, gsd: FakeGsd, gsdCore: string | null = "D:/gsd-core", slot: RunWorktreeSlot = { current: null }, route: RunShellRouteSlot = { current: null }): WorkspaceResolver {
  return new WorkspaceResolver(repos, gsd, { worktreeRoot: ROOT, gsdCore, identity }, slot, route);
}

describe("WorkspaceResolver", () => {
  it("leaves a request without a workspace as it is", async () => {
    const repos = new FakeRepos();
    const plain = request();

    const resolved = await resolver(repos, new FakeGsd()).resolve(plain);
    resolved.release();

    assert.equal(resolved.request, plain);
    assert.deepEqual(repos.calls, []);
  });

  it("runs a GSD workspace in its prepared worktree with GSD's settings and identity", async () => {
    const repos = new FakeRepos();
    const gsd = new FakeGsd();

    const resolved = await resolver(repos, gsd).resolve(workspaceRequest(true));

    assert.deepEqual(repos.calls, ["acquire app", `open app develop feature/123-totals ${worktree}`]);
    assert.deepEqual(gsd.prepared, [{ worktree, gsdCore: "D:/gsd-core", identity }]);
    assert.equal(resolved.request.cwd, worktree);
    assert.deepEqual(resolved.request.settingSources, ["project", "local"]);
    assert.deepEqual(resolved.request.env, { KEEP: "1", ...gsdEnv });
  });

  it("gives a workspace without GSD the runner's identity and the request's own settings", async () => {
    const gsd = new FakeGsd();

    const resolved = await resolver(new FakeRepos(), gsd).resolve(workspaceRequest(false));

    assert.deepEqual(gsd.prepared, []);
    assert.deepEqual(resolved.request.settingSources, ["project"]);
    assert.equal(resolved.request.env?.GIT_AUTHOR_NAME, "PowerLoom agent");
    assert.equal(resolved.request.env?.GIT_COMMITTER_EMAIL, "agent@powerloom.local");
  });

  it("releases the repo once, when the caller releases the workspace", async () => {
    const repos = new FakeRepos();

    const resolved = await resolver(repos, new FakeGsd()).resolve(workspaceRequest(true));
    resolved.release();

    assert.deepEqual(repos.calls.filter((call) => call.startsWith("release")), ["release app"]);
  });

  it("gives a workspace run the route its sandbox tools left for builds and tests, and a run without one none", async () => {
    const shellRoute = { run: async () => null };
    const routed = await resolver(new FakeRepos(), new FakeGsd(), "D:/gsd-core", { current: null }, { current: shellRoute }).resolve(workspaceRequest(true));
    const unrouted = await resolver(new FakeRepos(), new FakeGsd()).resolve(workspaceRequest(true));

    assert.equal(routed.request.shellRoute, shellRoute);
    assert.equal("shellRoute" in unrouted.request, false);
  });

  it("tells the sandbox tools the run's worktree and repo until the workspace is released", async () => {
    const slot: RunWorktreeSlot = { current: null };

    const resolved = await resolver(new FakeRepos(), new FakeGsd(), "D:/gsd-core", slot).resolve(workspaceRequest(true));

    assert.deepEqual(slot.current, { repo: "app", path: worktree });

    resolved.release();

    assert.equal(slot.current, null);
  });

  it("leaves the worktree slot empty for a request without a workspace or a failed worktree", async () => {
    const slot: RunWorktreeSlot = { current: null };

    await resolver(new FakeRepos(), new FakeGsd(), "D:/gsd-core", slot).resolve(request());
    await assert.rejects(resolver(new FakeRepos(true), new FakeGsd(), "D:/gsd-core", slot).resolve(workspaceRequest(true)));

    assert.equal(slot.current, null);
  });

  it("releases the repo when the worktree can't be opened", async () => {
    const repos = new FakeRepos(true);

    await assert.rejects(resolver(repos, new FakeGsd()).resolve(workspaceRequest(true)), /fetch failed/);

    assert.equal(repos.calls.at(-1), "release app");
  });

  it("fails a GSD workspace on a runner without GSD, and releases the repo", async () => {
    const repos = new FakeRepos();

    await assert.rejects(resolver(repos, new FakeGsd(), null).resolve(workspaceRequest(true)), /GSD_CORE_DIR is not set/);

    assert.equal(repos.calls.at(-1), "release app");
  });
});

// A runtime that yields one event, or throws, and records the request it ran.
class FakeRuntime implements AgentRuntime {
  readonly provider = "anthropic";
  readonly reportsSubscriptionInRuns = true;
  readonly conversations = null;
  ran: AgentRequest | null = null;

  constructor(private readonly fail = false) {}

  async *run(request: AgentRequest): AsyncIterable<AgentEvent> {
    this.ran = request;

    if (this.fail) {
      throw new Error("run failed");
    }

    yield { type: "text", text: "done" } as unknown as AgentEvent;
  }

  async subscriptionUsage() {
    return { provider: this.provider } as never;
  }
}

async function drain(events: AsyncIterable<AgentEvent>): Promise<number> {
  let count = 0;

  for await (const _event of events) {
    count++;
  }

  return count;
}

describe("WorkspaceRuntime", () => {
  it("runs the resolved request and releases the repo when the run ends", async () => {
    const repos = new FakeRepos();
    const inner = new FakeRuntime();

    const count = await drain(new WorkspaceRuntime(inner, resolver(repos, new FakeGsd())).run(workspaceRequest(true)));

    assert.equal(count, 1);
    assert.equal(inner.ran?.cwd, worktree);
    assert.equal(repos.calls.at(-1), "release app");
  });

  it("releases the repo when the run fails", async () => {
    const repos = new FakeRepos();

    await assert.rejects(drain(new WorkspaceRuntime(new FakeRuntime(true), resolver(repos, new FakeGsd())).run(workspaceRequest(true))), /run failed/);

    assert.equal(repos.calls.at(-1), "release app");
  });
});
