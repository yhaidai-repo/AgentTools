import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { RUN_OUTCOME_GROUPS, RUN_OUTCOME_GROUP_KEYS, outcomeGroupOf } from "./runOutcomes";

describe("the Runs tab's outcome pills", () => {
  it("groups a run the user stopped with the budget stops, not with the failures", () => {
    assert.equal(outcomeGroupOf("aborted"), "stopped");
    assert.equal(outcomeGroupOf("budget-exceeded"), "stopped");
  });

  it("keeps running, failed and succeeded runs in their own pills", () => {
    assert.equal(outcomeGroupOf("running"), "running");
    assert.equal(outcomeGroupOf("failed"), "failed");
    assert.equal(outcomeGroupOf("timeout"), "failed");
    assert.equal(outcomeGroupOf("success"), "succeeded");
    assert.equal(outcomeGroupOf("no-op"), "succeeded");
  });

  it("offers the same groups as pills and as the run list's filter", () => {
    assert.deepEqual(RUN_OUTCOME_GROUPS.map((group) => group.key), [...RUN_OUTCOME_GROUP_KEYS]);
    assert.equal(RUN_OUTCOME_GROUPS.find((group) => group.key === "stopped")?.label, "Stopped");
  });
});
