import assert from "node:assert/strict";
import { afterEach, it, mock } from "node:test";
import { runAcceptedJob } from "./runAcceptedJob";

afterEach(() => mock.restoreAll());
const job = { taskId: "AT-1", agentId: "synthetic", pbiId: null };

for (const fault of ["none", "retention", "browser", "stack", "azure", "report", "execute"]) {
  it(`attempts the full accepted lifecycle after ${fault}`, async () => {
    mock.method(console, "error", () => {});
    const calls: string[] = [];
    const step = async (name: string) => { calls.push(name); if (fault === name) throw new Error(`synthetic ${name}`); };
    let result: { runId: number | null; outcome: string } | undefined;
    await runAcceptedJob(job, {
      maintain: () => step("retention"),
      execute: async () => { await step("execute"); return { runId: 9, outcome: "success", error: null }; },
      cleanups: ["browser", "stack", "azure"].map((name) => () => step(name)),
      report: async (completed) => { result = completed; await step("report"); },
    });
    assert.deepEqual(calls, ["retention", "execute", "browser", "stack", "azure", "report"]);
    assert.equal(result?.outcome, fault === "execute" ? "failed" : "success");
    assert.equal(result?.runId, fault === "execute" ? null : 9);
  });
}
