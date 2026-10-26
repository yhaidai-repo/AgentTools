import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isLimitStop, keepsOnlyResult, stoppedResult } from "./limitStops";

describe("limit stops", () => {
  it("are the budget, the turns and the time, not a failure or an abort", () => {
    assert.deepEqual(["budget-exceeded", "max-turns", "timeout", "failed", "aborted", "success", "rate-limited"].map((outcome) => isLimitStop(outcome as never)), [true, true, true, false, false, false, false]);
  });

  it("leave a partial result with the agent's last words when it wrote none", () => {
    const result = stoppedResult("max-turns", "Found the mapping in Payer.cs; still checking the tests.");

    assert.equal(result.status, "partial");
    assert.equal(result.body, "Stopped by its turn limit before it wrote a result.\n\nIts last notes:\n\nFound the mapping in Payer.cs; still checking the tests.");
    assert.equal(stoppedResult("timeout", "").body, "Stopped by its time limit before it wrote a result.\n\nIt left no notes.");
  });

  it("keep only the result when turns or time ran out, everything at a budget stop", () => {
    assert.deepEqual(["max-turns", "timeout", "budget-exceeded", "success"].map((outcome) => keepsOnlyResult(outcome as never)), [true, true, false, false]);
  });
});
