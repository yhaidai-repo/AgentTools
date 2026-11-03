import assert from "node:assert/strict";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { clearReviewCheckouts } from "./reviewCheckouts";

async function cacheWithCheckouts(runIds: number[]): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "review-checkouts-"));

  for (const runId of runIds) {
    await mkdir(join(root, ".reviews", `run-${runId}`, "repo"), { recursive: true });
    await writeFile(join(root, ".reviews", `run-${runId}`, "repo", "file.txt"), "x");
  }

  return root;
}

describe("clearReviewCheckouts", () => {
  it("removes every run's checkout at a cold start", async (t) => {
    const root = await cacheWithCheckouts([7, 8]);
    t.after(() => rm(root, { recursive: true, force: true }));

    await clearReviewCheckouts(root);

    assert.deepEqual(await readdir(root), []);
  });

  it("keeps the checkouts of the runs in progress", async (t) => {
    const root = await cacheWithCheckouts([7, 8, 9]);
    t.after(() => rm(root, { recursive: true, force: true }));

    await clearReviewCheckouts(root, new Set([8]));

    assert.deepEqual(await readdir(join(root, ".reviews")), ["run-8"]);
  });

  it("does nothing without a checkouts folder", async (t) => {
    const root = await mkdtemp(join(tmpdir(), "review-checkouts-"));
    t.after(() => rm(root, { recursive: true, force: true }));

    await clearReviewCheckouts(root, new Set([8]));
    await clearReviewCheckouts(root);

    assert.deepEqual(await readdir(root), []);
  });
});
