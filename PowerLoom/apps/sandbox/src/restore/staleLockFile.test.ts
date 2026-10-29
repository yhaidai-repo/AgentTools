import assert from "node:assert/strict";
import { test } from "node:test";
import type { RestoreStepResult } from "@powerloom/sandbox";
import type { RestoreStep } from "../models/RestoreStep";
import { runWithStaleLockFallback } from "./staleLockFile";

const NU1004 = "error NU1004: The package references have changed for net9.0. Lock file's package references: None, project's package references: Polly:[8.4.2, ).";

function dotnetStep(...extra: string[]): RestoreStep {
  return { label: "dotnet restore App.sln", ecosystem: "dotnet", argv: ["dotnet", "restore", "App.sln", ...extra], cwd: "/work/app" };
}

// Answers each run with the next result and records the argv it was given.
function runner(results: Array<Pick<RestoreStepResult, "exitCode" | "output">>) {
  const ran: string[][] = [];
  const run = (step: RestoreStep): Promise<RestoreStepResult> => {
    const next = results[ran.length];

    ran.push(step.argv);

    return Promise.resolve({ label: step.label, durationMs: 1000, ...next });
  };

  return { ran, run };
}

test("a locked restore failing on a stale lock file runs again without --locked-mode and says so", async () => {
  const { ran, run } = runner([{ exitCode: 1, output: NU1004 }, { exitCode: 0, output: "Restored /work/app/App.csproj" }]);

  const step = await runWithStaleLockFallback(dotnetStep("--locked-mode"), run);

  assert.deepEqual(ran, [["dotnet", "restore", "App.sln", "--locked-mode"], ["dotnet", "restore", "App.sln"]]);
  assert.equal(step.result.exitCode, 0);
  assert.equal(step.result.durationMs, 2000);
  assert.equal(step.note, "lock file out of date for dotnet restore App.sln (NU1004): restored without --locked-mode (regenerate packages.lock.json in the repo)");
});

test("a locked restore failing on another error is not run again", async () => {
  const { ran, run } = runner([{ exitCode: 1, output: "error NU1101: Unable to find package Polly." }]);

  const step = await runWithStaleLockFallback(dotnetStep("--locked-mode"), run);

  assert.equal(ran.length, 1);
  assert.equal(step.result.exitCode, 1);
  assert.equal(step.note, null);
});

test("an unlocked restore is left as it ran, whatever its output", async () => {
  const { ran, run } = runner([{ exitCode: 1, output: NU1004 }]);

  const step = await runWithStaleLockFallback(dotnetStep(), run);

  assert.equal(ran.length, 1);
  assert.equal(step.result.exitCode, 1);
  assert.equal(step.note, null);
});
