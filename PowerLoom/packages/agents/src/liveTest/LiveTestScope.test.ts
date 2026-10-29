import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LiveTestScope } from "./LiveTestScope";

// Q-500-001 belongs to PBI 500, Q-38519-001 to a real PBI; T-9 is a task without a PBI.
const ITEM_PBIS: Record<string, number | null> = { "Q-500-001": 500, "Q-38519-001": 38519, "T-9": null };
const lookup = async (itemId: string) => ITEM_PBIS[itemId];

describe("LiveTestScope", () => {
  it("owns what the run created and an item of a PBI it created, nothing else", async () => {
    const scope = new LiveTestScope(lookup);

    scope.record([{ kind: "pbi", id: "500", pbiId: null }]);

    assert.equal(await scope.notOwnedProblem([{ kind: "pbi", id: "500" }, { kind: "item", id: "Q-500-001" }]), null);
    assert.equal(await scope.notOwnedProblem([{ kind: "pbi", id: "38519" }]), "PBI-38519 wasn't created by this test run; a live test changes only its own data.");
    assert.match((await scope.notOwnedProblem([{ kind: "item", id: "Q-38519-001" }])) ?? "", /^Q-38519-001 wasn't created/);
    assert.match((await scope.notOwnedProblem([{ kind: "item", id: "T-9" }])) ?? "", /^T-9 wasn't created/);
  });

  it("forgets a deleted PBI with its tasks and child PBIs", () => {
    const scope = new LiveTestScope(lookup);

    scope.record([{ kind: "pbi", id: "500", pbiId: null }, { kind: "pbi", id: "501", pbiId: 500 }, { kind: "task", id: "T-1", pbiId: 501 }, { kind: "agent", id: "probe" }]);
    scope.forget([{ kind: "pbi", id: "500" }]);

    assert.deepEqual(scope.leftovers(), [{ kind: "agent", id: "probe" }]);
  });

  it("leaves agents, schedules, tasks without a held PBI, then PBIs newest first", () => {
    const scope = new LiveTestScope(lookup);

    scope.record([
      { kind: "pbi", id: "500", pbiId: null },
      { kind: "task", id: "T-1", pbiId: 500 },
      { kind: "pbi", id: "501", pbiId: 500 },
      { kind: "schedule", id: "7" },
      { kind: "task", id: "T-2", pbiId: null },
      { kind: "agent", id: "probe" },
    ]);

    assert.deepEqual(scope.leftovers().map((entity) => `${entity.kind} ${entity.id}`), ["agent probe", "schedule 7", "task T-2", "pbi 501", "pbi 500"]);
  });
});
