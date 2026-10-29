import assert from "node:assert/strict";
import { test } from "node:test";
import type { CacheCount } from "../models/CacheCount";
import { lastOutputLine } from "./lastOutputLine";
import { cacheCountOf } from "./packageCacheSize";
import { RestoreBudget } from "./RestoreBudget";
import { RestoreTracker } from "./RestoreTracker";

const MINUTE = 60_000;

function measures(...counts: (CacheCount | null)[]): () => Promise<CacheCount | null> {
  return () => Promise.resolve(counts.length > 1 ? (counts.shift() ?? null) : (counts[0] ?? null));
}

test("a restore waiting its turn reports its time left and no cache", async () => {
  const tracker = new RestoreTracker(new RestoreBudget(15 * MINUTE, () => 0));

  const progress = await tracker.progress();

  assert.equal(progress.stage, "waiting");
  assert.equal(progress.remainingMs, 15 * MINUTE);
  assert.equal(progress.step, null);
  assert.equal(progress.cache, null);
});

test("a running step reports its number, its last output line and the packages the restore added", async () => {
  const tracker = new RestoreTracker(new RestoreBudget(15 * MINUTE));

  tracker.copying(measures({ nugetPackages: 40, bytes: 100 }, { nugetPackages: 121, bytes: 311 * 1024 * 1024 }));
  await tracker.planned(2);
  tracker.stepStarted("dotnet add package Polly");
  tracker.stepEnded({ label: "dotnet add package Polly", exitCode: 0, durationMs: 2_000, output: "added" });
  tracker.stepStarted("dotnet restore App.sln");
  tracker.printed(Buffer.from("  Determining projects to restore...\n  Restored /work/App/Api.csproj (in 2.1 min).\n\n"));

  const progress = await tracker.progress();

  assert.equal(progress.stage, "restoring");
  assert.equal(progress.stepCount, 2);
  assert.equal(progress.step?.number, 2);
  assert.equal(progress.step?.label, "dotnet restore App.sln");
  assert.deepEqual(progress.ended, [{ label: "dotnet add package Polly", exitCode: 0, durationMs: 2_000 }]);
  assert.equal(progress.lastLine, "Restored /work/App/Api.csproj (in 2.1 min).");
  assert.deepEqual(progress.cache, { nugetPackages: 121, bytes: 311 * 1024 * 1024, addedPackages: 81 });
});

test("after its last step a restore names no step and no output line", async () => {
  const tracker = new RestoreTracker(new RestoreBudget(15 * MINUTE));

  tracker.copying(measures(null));
  await tracker.planned(1);
  tracker.stepStarted("npm ci");
  tracker.printed(Buffer.from("added 300 packages\n"));
  tracker.stepEnded({ label: "npm ci", exitCode: 124, durationMs: 900_000, output: "" });

  const progress = await tracker.progress();

  assert.equal(progress.step, null);
  assert.equal(progress.lastLine, null);
  assert.equal(progress.cache, null);
  assert.equal(progress.ended[0].exitCode, 124);
});

test("the cache measure reads the package count and the size in kilobytes", () => {
  assert.deepEqual(cacheCountOf("121\n318464\n"), { nugetPackages: 121, bytes: 318464 * 1024 });
  assert.equal(cacheCountOf("121\n"), null);
  assert.equal(cacheCountOf(""), null);
});

test("the last output line skips blank lines and is cut short", () => {
  assert.equal(lastOutputLine("first\r\nsecond  \r\n\r\n"), "second");
  assert.equal(lastOutputLine("\n \n"), null);
  assert.equal(lastOutputLine("x".repeat(250))?.length, 201);
});
