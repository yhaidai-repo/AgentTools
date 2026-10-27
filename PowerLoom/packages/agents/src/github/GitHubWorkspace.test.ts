import assert from "node:assert/strict";
import { it } from "node:test";
import type { RepoCache } from "@agenttools/runtime";
import { GitHubWorkspace } from "./GitHubWorkspace";
import type { GitHubRepoTarget } from "./models/GitHubRepoTarget";

const target: GitHubRepoTarget = { owner: "synthetic", name: "repo", ref: { name: "synthetic-repo", remoteUrl: "https://example.invalid/repo", defaultBranch: "main" } };

function setup(fail: "acquire" | "checkout" | "cleanup" | null = null) {
  const calls: string[] = [];
  const failure = new Error(`synthetic ${fail} failure`);
  const cache = {
    root: "synthetic-cache",
    acquire: async () => { calls.push("acquire"); if (fail === "acquire") throw failure; },
    checkoutNewBranch: async () => { calls.push("checkout"); if (fail === "checkout") throw failure; return "commit"; },
    removeCheckout: async () => { calls.push("remove"); if (fail === "cleanup") throw failure; },
    release: () => { calls.push("release"); },
  } as unknown as RepoCache;
  return { workspace: new GitHubWorkspace(cache, 7, "AT-1", "synthetic"), calls, failure };
}

it("does not release a failed acquisition that never belonged to the workspace", async () => {
  const { workspace, calls, failure } = setup("acquire");
  await assert.rejects(workspace.start(target), (error) => error === failure);
  await workspace.cleanUp();
  assert.deepEqual(calls, ["acquire"]);
});

it("removes a partial checkout and releases exactly once when branch setup fails", async () => {
  const { workspace, calls, failure } = setup("checkout");
  await assert.rejects(workspace.start(target), (error) => error === failure);
  await workspace.cleanUp();
  assert.deepEqual(calls, ["acquire", "checkout", "remove", "release"]);
  assert.equal(workspace.copyOf(target.name), null);
});

it("shares concurrent starts and releases a successful working copy exactly once", async () => {
  const { workspace, calls } = setup();
  const [first, second] = await Promise.all([workspace.start(target), workspace.start(target)]);
  assert.equal(first.copy, second.copy);
  await workspace.cleanUp();
  await workspace.cleanUp();
  assert.deepEqual(calls, ["acquire", "checkout", "remove", "release"]);
});

it("releases all owned repositories even if checkout removal fails", async () => {
  const { workspace, calls } = setup("cleanup");
  await workspace.start(target);
  await workspace.start({ ...target, name: "other", ref: { ...target.ref, name: "other" } });
  await assert.rejects(workspace.cleanUp(), AggregateError);
  await workspace.cleanUp();
  assert.equal(calls.filter((call) => call === "release").length, 2);
});
