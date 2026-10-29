import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runCommand, type Command } from "@powerloom/core";
import { fakeLiveTestContext } from "./fakeLiveTestContext";
import { liveTestCommands } from "./liveTestCommands";
import { LiveTestScope } from "./LiveTestScope";
import { deleteQueuedRefinement } from "./queuedRefinement";

describe("pbi.prepare in a live test", () => {
  it("prepares only the run's own PBI and deletes the refinement task it queues", async () => {
    const calls: string[] = [];
    const context = fakeLiveTestContext(calls);
    const commands = liveTestCommands(new LiveTestScope(async () => undefined));
    const call = (name: string, input: unknown) => runCommand(commands.find((command) => command.name === name) as Command<unknown, unknown>, context, input);

    const refused = await call("pbi.prepare", { adoIds: [38519] });
    const created = await call("pbi.create", { vault: "personal-projects", title: "[selftest] prepare" });
    const adoId = created.ok ? (created.value as { adoId: number }).adoId : 0;
    const prepared = await call("pbi.prepare", { adoIds: [adoId] });

    assert.equal(refused.ok, false);
    assert.equal(prepared.ok, true);
    assert.deepEqual(calls, ["createPbi", `preparePbis ${adoId}`, `deleteItem ${adoId} R-${adoId}`]);
  });

  it("fails the call when no refinement task appears, saying what to delete", async () => {
    const problem = await deleteQueuedRefinement(fakeLiveTestContext([], false), [901], 300);

    assert.equal(problem, "no refinement task appeared for PBI-901 within 0.3 s: delete it with item_delete once it does");
  });
});

describe("bug.report in a live test", () => {
  function setUp() {
    const calls: string[] = [];
    const scope = new LiveTestScope(async () => undefined);
    const context = fakeLiveTestContext(calls);
    const commands = liveTestCommands(scope);
    const call = (name: string, input: unknown) => runCommand(commands.find((command) => command.name === name) as Command<unknown, unknown>, context, input);

    return { calls, scope, call };
  }

  it("files a bug only under a PBI the run created and deletes the refinement task the backend queues for it", async () => {
    const { calls, scope, call } = setUp();

    const refused = await call("bug.report", { parent: "38519", title: "[selftest] bug" });
    const created = await call("pbi.create", { vault: "personal-projects", title: "[selftest] parent" });
    const parent = created.ok ? (created.value as { adoId: number }).adoId : 0;
    const reported = await call("bug.report", { parent: `#${parent}`, title: "[selftest] bug" });
    const bug = reported.ok ? (reported.value as { adoId: number }).adoId : 0;

    assert.equal(refused.ok, false);
    assert.equal(reported.ok, true);
    assert.deepEqual(calls, ["createPbi", "reportBug", `deleteItem ${bug} R-${bug}`]);
    assert.deepEqual(scope.leftovers().map((entity) => entity.id), [String(bug), String(parent)]);
  });

  it("says which PBI to delete the refinement task of when none appears", async () => {
    const problem = await deleteQueuedRefinement(fakeLiveTestContext([], false), [901], 300);

    assert.equal(problem, "no refinement task appeared for PBI-901 within 0.3 s: delete it with item_delete once it does");
  });
});
