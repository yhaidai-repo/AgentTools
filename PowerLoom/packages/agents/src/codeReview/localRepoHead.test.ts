import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PowerLoomDb, pullRequest } from "@powerloom/db";
import { recordLocalRepoHead } from "./localRepoHead";

type PullRequestRow = typeof pullRequest.$inferSelect;

function recordingDb(saved: Record<string, unknown>[]): PowerLoomDb {
  return { update: () => ({ set: (values: Record<string, unknown>) => ({ where: async () => saved.push(values) }) }) } as unknown as PowerLoomDb;
}

describe("recordLocalRepoHead", () => {
  const pr = { id: 9000001, origin: "local-repo", sourceCommit: "a".repeat(40) } as PullRequestRow;

  it("moves a local review's head to the commit the run reviewed", async () => {
    const saved: Record<string, unknown>[] = [];
    const seen = await recordLocalRepoHead(recordingDb(saved), pr, "b".repeat(40));

    assert.equal(seen.sourceCommit, "b".repeat(40));
    assert.equal(saved[0].sourceCommit, "b".repeat(40));
  });

  it("leaves a pull request and an unchanged head alone", async () => {
    const saved: Record<string, unknown>[] = [];

    await recordLocalRepoHead(recordingDb(saved), { ...pr, origin: "sync" }, "b".repeat(40));
    await recordLocalRepoHead(recordingDb(saved), pr, pr.sourceCommit);

    assert.deepEqual(saved, []);
  });
});
