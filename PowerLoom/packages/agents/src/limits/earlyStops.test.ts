import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isEarlyStop, keepsOnlyResult, stoppedResult } from "./earlyStops";

describe("early stops", () => {
  it("are the budget, the turns, the time and Stop, not a failure, a success or a rate limit", () => {
    assert.deepEqual(["budget-exceeded", "max-turns", "timeout", "aborted", "failed", "success", "rate-limited"].map((outcome) => isEarlyStop(outcome as never)), [true, true, true, true, false, false, false]);
  });

  it("leave a partial result with the agent's last words when it wrote none", () => {
    const result = stoppedResult("max-turns", "Found the mapping in Payer.cs; still checking the tests.");

    assert.equal(result.status, "partial");
    assert.equal(result.body, "Stopped by its turn limit before it wrote a result.\n\nIts last notes:\n\nFound the mapping in Payer.cs; still checking the tests.");
    assert.equal(stoppedResult("timeout", "").body, "Stopped by its time limit before it wrote a result.\n\nIt left no notes.");
    assert.match(stoppedResult("aborted", "").body, /^Stopped by Stop in PowerLoom before it wrote a result/);
  });

  it("keep only the result when turns or time ran out or on Stop, everything at a budget stop", () => {
    assert.deepEqual(["max-turns", "timeout", "aborted", "budget-exceeded", "success"].map((outcome) => keepsOnlyResult(outcome as never)), [true, true, true, false, false]);
  });
});
