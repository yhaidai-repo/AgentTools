import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cleanUpLiveTest } from "./cleanUpLiveTest";
import { fakeLiveTestContext } from "./fakeLiveTestContext";
import { LiveTestScope } from "./LiveTestScope";

describe("cleanUpLiveTest", () => {
  it("removes agents, schedules, tasks without a held PBI, then PBIs, and empties the scope", async () => {
    const calls: string[] = [];
    const scope = new LiveTestScope(async () => undefined);

    scope.record([
      { kind: "pbi", id: "500", pbiId: null },
      { kind: "task", id: "T-1", pbiId: 500 },
      { kind: "pbi", id: "501", pbiId: 500 },
      { kind: "schedule", id: "7" },
      { kind: "task", id: "T-2", pbiId: null },
      { kind: "agent", id: "selftest-probe" },
    ]);

    const report = await cleanUpLiveTest(scope, fakeLiveTestContext(calls));

    assert.deepEqual(calls, ["removeAgent selftest-probe", "deleteSchedule 7", "deleteItem null T-2", "deletePbi 501", "deletePbi 500"]);
    assert.deepEqual(report, { removed: ["agent selftest-probe", "schedule 7", "task T-2", "pbi 501", "pbi 500"], failed: [] });
    assert.equal(scope.isEmpty, true);
  });

  it("keeps going past a failure and a throw, reporting them, and keeps what it couldn't remove", async () => {
    const calls: string[] = [];
    const scope = new LiveTestScope(async () => undefined);
    const context = fakeLiveTestContext(calls);

    (context.powerloom as unknown as Record<string, unknown>).deleteSchedule = async () => ({ ok: false, error: "no such schedule" });
    (context.powerloom as unknown as Record<string, unknown>).deleteItem = async () => {
      throw new Error("PowerLoom is down");
    };
    scope.record([{ kind: "schedule", id: "7" }, { kind: "task", id: "T-2", pbiId: null }, { kind: "pbi", id: "500", pbiId: null }]);

    const report = await cleanUpLiveTest(scope, context);

    assert.deepEqual(report, { removed: ["pbi 500"], failed: ["schedule 7: no such schedule", "task T-2: PowerLoom is down"] });
    assert.deepEqual(scope.leftovers().map((entity) => entity.id), ["7", "T-2"]);
  });
});
