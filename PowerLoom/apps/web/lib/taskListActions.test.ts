import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { localItem } from "@powerloom/db";
import { isSelectableTask, taskListActionOf, taskListRefusal } from "./taskListActions";

type ItemRow = typeof localItem.$inferSelect;

function task(change: Partial<ItemRow>): ItemRow {
  return { id: "AT-1-001", kind: "research", status: "open", assignee: "agent:research", attempts: 0, heldBy: [], ...change } as ItemRow;
}

describe("the Tasks list's actions", () => {
  it("re-runs a failed or finished agent task and cancels one that waits", () => {
    const failed = task({ attempts: 1 });
    const done = task({ status: "done" });

    assert.equal(taskListRefusal(failed, "rerun"), null);
    assert.equal(taskListRefusal(done, "start-over"), null);
    assert.equal(taskListRefusal(failed, "cancel"), null);
    assert.match(taskListRefusal(done, "cancel") ?? "", /no longer waits/);
    assert.match(taskListRefusal(task({ status: "in-progress" }), "rerun") ?? "", /can't be re-run/);
  });

  it("ticks a finished agent task, but not a human task that is done", () => {
    assert.equal(isSelectableTask(task({ status: "done" })), true);
    assert.equal(isSelectableTask(task({ kind: "human", assignee: "human", status: "done" })), false);
  });

  it("knows only its three actions", () => {
    assert.equal(taskListActionOf("start-over"), "start-over");
    assert.equal(taskListActionOf("delete"), null);
  });
});
