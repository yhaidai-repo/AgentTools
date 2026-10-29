import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { implementationSnapshot, type BuildContent, type PowerLoomDb } from "@powerloom/db";
import type { BuildVersion } from "../models/BuildVersion";
import { readPbiReference } from "../pbiContext/readPbiReference";
import { buildLines } from "./latestBuild";

const CONTENT: BuildContent = {
  summary: "Expired orders are archived nightly.",
  planVersion: 2,
  repo: "Shop",
  branch: "powerloom/pbi-7",
  baseBranch: "main",
  worktree: "/cache/.worktrees/shop/Shop/powerloom-pbi-7",
  headSha: "abc1234",
  commands: { build: "dotnet build Shop.sln", test: "dotnet test Shop.sln" },
  plans: [{ id: "01-01", phase: "01", wave: 1, objective: "Archive orders.", status: "done", tasksDone: 2, tasksTotal: 2, changedFiles: ["Orders/Archive.cs"], oneLiner: "Nightly archive job" }],
  commits: [{ sha: "abc1234", message: "feat(01-01): archive expired orders" }],
  deviations: [],
  checkpoints: [],
  verification: [{ phase: "01", status: "passed", score: "3/3", truths: [] }],
  uat: [],
  handOver: { state: "ready", verdict: "passed 3/3", prTitle: "Archive expired orders", itemId: "HT-7-002" },
};

const LATEST: BuildVersion = { id: 4, pbiId: 7, version: 1, planVersion: 2, runId: 52, createdAt: new Date("2026-10-29T12:00:00Z"), build: CONTENT };

// Answers the latest-build query of the implementation_snapshot table with the given rows; any other table has none.
function dbWith(rows: BuildVersion[]): PowerLoomDb {
  const query = (table: unknown) => ({ where: () => ({ orderBy: () => ({ limit: async () => (table === implementationSnapshot ? rows : []) }) }) });

  return { select: () => ({ from: query }) } as unknown as PowerLoomDb;
}

describe("buildLines", () => {
  it("names the version, branch, hand-over state, commits and each plan's progress", () => {
    assert.deepEqual(buildLines(LATEST), [
      "Build v1 on powerloom/pbi-7 (ready): Expired orders are archived nightly.",
      "Commits: 1; verification: passed 3/3",
      "Plans:",
      "- 01-01: done (2/2 tasks)",
    ]);
  });
});

describe("readPbiReference PBI-<id>:build", () => {
  it("reads the latest implementation with the run that wrote it", async () => {
    const outcome = await readPbiReference(dbWith([LATEST]), "", "PBI-7:build");

    assert.equal(outcome.ok, true);
    const read = JSON.parse(outcome.ok ? outcome.value : "{}");
    assert.equal(read.version, 1);
    assert.equal(read.run, "RUN-52");
    assert.equal(read.planVersion, 2);
    assert.equal(read.branch, "powerloom/pbi-7");
    assert.deepEqual(read.commits, CONTENT.commits);
  });

  it("says when the PBI has no implementation yet", async () => {
    const outcome = await readPbiReference(dbWith([]), "", "PBI-7:build");

    assert.equal(outcome.ok, false);
  });
});
