import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ToolCallContext, ToolDefinition } from "@agenttools/runtime";
import type { RestoreProgress, RestoreResult, SandboxAnswer } from "@powerloom/sandbox";
import { withLimitNotes } from "../limits/limitNotes";
import { RestoreProgressReporter } from "./RestoreProgressReporter";
import { restoreEndText, restoreProgressText } from "./restoreProgressText";
import { whilePending } from "./whilePending";

const MINUTE = 60_000;
const MB = 1024 * 1024;
const NOW = new Date("2026-10-29T12:20:00Z");

function progressWith(fields: Partial<RestoreProgress>): RestoreProgress {
  return { stage: "restoring", startedAt: "2026-10-29T12:11:35Z", remainingMs: 11 * MINUTE, stepCount: 0, step: null, ended: [], lastLine: null, cache: null, ...fields };
}

function recordingCall(): { call: ToolCallContext; reported: string[] } {
  const reported: string[] = [];

  return { call: { progress: (detail) => reported.push(detail) }, reported };
}

function later<T>(value: T, ms: number): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

const RESTORED: SandboxAnswer<RestoreResult> = { ok: true, value: { ok: true, steps: [{ label: "dotnet restore App.sln", exitCode: 0, durationMs: 3 * MINUTE, output: "" }], skipped: [], packagesPath: "/packages" } };

describe("restoreProgressText", () => {
  it("names the running step, its time, the cache, the time left and the last output line", () => {
    const text = restoreProgressText(progressWith({
      stepCount: 3,
      step: { number: 2, label: "dotnet restore App.sln", startedAt: "2026-10-29T12:17:00Z" },
      cache: { nugetPackages: 121, bytes: 311 * MB, addedPackages: 81 },
      lastLine: "Restored /work/App/Api.csproj (in 2.1 min).",
    }), NOW);

    assert.equal(text, "step 2/3 dotnet restore App.sln · 3 min · 121 NuGet packages (+81), 311 MB cached · 11 min left · Restored /work/App/Api.csproj (in 2.1 min).");
  });

  it("says when the restore waits its turn or copies the repo in", () => {
    assert.equal(restoreProgressText(progressWith({ stage: "waiting", remainingMs: 14 * MINUTE }), NOW), "waiting for an earlier restore of this package cache · 14 min left");
    assert.equal(restoreProgressText(progressWith({ stage: "copying", remainingMs: 40_000 }), NOW), "copying the repo in · 40 s left");
  });

  it("counts done and failed steps between steps, and an npm cache by its size only", () => {
    const text = restoreProgressText(progressWith({
      stepCount: 2,
      ended: [{ label: "npm ci", exitCode: 1, durationMs: 5_000 }],
      cache: { nugetPackages: 0, bytes: 2 * 1024 * MB, addedPackages: 0 },
    }), NOW);

    assert.equal(text, "1/2 steps done · 2.0 GB cached · 1 step failed · 11 min left");
  });
});

describe("restoreEndText", () => {
  it("states how each step ended, a timeout by name", () => {
    const answer: SandboxAnswer<RestoreResult> = { ok: true, value: { ok: false, skipped: [], packagesPath: "/packages", steps: [
      { label: "dotnet add package Polly", exitCode: 0, durationMs: 2_000, output: "" },
      { label: "dotnet restore App.sln", exitCode: 124, durationMs: 15 * MINUTE, output: "" },
      { label: "npm ci", exitCode: 1, durationMs: 30_000, output: "" },
    ] } };

    assert.equal(restoreEndText(answer), "ended: dotnet add package Polly ok in 2 s · dotnet restore App.sln timed out after 15 min · npm ci failed (exit 1) after 30 s");
  });

  it("gives the service's reason when the restore didn't run, and says when there was nothing to restore", () => {
    assert.equal(restoreEndText({ ok: false, message: "Package restore is off on this host", failure: "refused" }), "ended: Package restore is off on this host");
    assert.equal(restoreEndText({ ok: true, value: { ok: true, steps: [], skipped: [], packagesPath: "/packages" } }), "ended: nothing to restore");
  });
});

describe("RestoreProgressReporter", () => {
  it("reports the service's progress while the restore runs, then how it ended", async () => {
    const { call, reported } = recordingCall();
    const read = async (): Promise<SandboxAnswer<RestoreProgress | null>> => ({ ok: true, value: progressWith({ stage: "copying", remainingMs: 14 * MINUTE }) });
    const reporter = new RestoreProgressReporter(read, call, 10);

    const answer = await reporter.watch(later(RESTORED, 45));

    assert.equal(answer, RESTORED);
    assert.ok(reported.length >= 2);
    assert.equal(reported[0], "copying the repo in · 14 min left");
    assert.equal(reported.at(-1), "ended: dotnet restore App.sln ok in 3 min");
  });

  it("reports nothing for a read that fails or finds no restore, nor one that answers after the end", async () => {
    const { call, reported } = recordingCall();
    const answers: SandboxAnswer<RestoreProgress | null>[] = [{ ok: false, message: "down", failure: "failed" }, { ok: true, value: null }];
    const read = () => later<SandboxAnswer<RestoreProgress | null>>(answers.shift() ?? { ok: true, value: progressWith({}) }, 30);
    const reporter = new RestoreProgressReporter(read, call, 10);

    await reporter.watch(later(RESTORED, 55));
    await later(null, 40);

    assert.deepEqual(reported, ["ended: dotnet restore App.sln ok in 3 min"]);
  });

  it("doesn't read the progress of a call outside a run", async () => {
    let reads = 0;
    const reporter = new RestoreProgressReporter(async () => { reads++; return { ok: true, value: null }; }, undefined, 5);

    await reporter.watch(later(RESTORED, 30));

    assert.equal(reads, 0);
  });
});

describe("whilePending", () => {
  it("never runs two ticks at once and stops ticking once the promise settles", async () => {
    let running = 0;
    let most = 0;
    let ticks = 0;
    const tick = async () => {
      running++;
      ticks++;
      most = Math.max(most, running);
      await later(null, 25);
      running--;
    };

    await whilePending(later("done", 60), 5, tick);

    const ticksAtEnd = ticks;

    await later(null, 40);

    assert.equal(most, 1);
    assert.equal(ticks, ticksAtEnd);
  });
});

describe("tool wrappers", () => {
  it("pass the call's context on to the tool", async () => {
    const { call, reported } = recordingCall();
    const tool: ToolDefinition<any> = { name: "slow", description: "", input: {}, handler: async (_input, context) => { context?.progress("half way"); return { text: "ok" }; } };
    const [wrapped] = withLimitNotes([tool], () => ({ turns: 1, maxTurns: 10, spentUsd: 0, budgetUsd: 0 }), "write_result");

    await wrapped.handler({}, call);

    assert.deepEqual(reported, ["half way"]);
  });
});
