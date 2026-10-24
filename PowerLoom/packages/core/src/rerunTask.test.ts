import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { localItem } from "@powerloom/db";
import { isRerunnableTask } from "./rerunTask";

type ItemRow = typeof localItem.$inferSelect;

function task(fields: Partial<ItemRow>): ItemRow {
  return { assignee: "agent:*", kind: "research", status: "open", attempts: 0, heldBy: [], ...fields } as ItemRow;
}

describe("isRerunnableTask", () => {
  it("offers Re-run on a finished or blocked agent task, and on one that failed and waits for another attempt", () => {
    assert.equal(isRerunnableTask(task({ status: "done" })), true);
    assert.equal(isRerunnableTask(task({ status: "blocked" })), true);
    assert.equal(isRerunnableTask(task({ attempts: 1 })), true);
    assert.equal(isRerunnableTask(task({ heldBy: ["rate limited; agents are paused until the limit resets"] })), true);
  });

  it("not on a fresh open task, a running one, a human task or a research result", () => {
    assert.equal(isRerunnableTask(task({})), false);
    assert.equal(isRerunnableTask(task({ status: "in-progress", attempts: 1 })), false);
    assert.equal(isRerunnableTask(task({ assignee: "human", status: "done" })), false);
    assert.equal(isRerunnableTask(task({ kind: "research-result", status: "done" })), false);
  });
});
