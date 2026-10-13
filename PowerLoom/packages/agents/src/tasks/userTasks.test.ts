import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CHECK_EACH_CRITERION, acceptanceCriteriaBlock, goalTextOf, userRequestBlock } from "./userTasks";

const userTask = { id: "RT-100-001", title: "Refine the export", body: "Focus on the CSV limits.", data: { createdBy: "user", doneWhen: "Limits are listed" } } as never;
const scheduledGoal = { id: "GT-007", title: "Nightly check", body: "Look around", data: { goal: "Look around", scheduleId: 3 } } as never;

describe("tasks the user created", () => {
  it("give the agent the description and the acceptance criteria, answered one by one", () => {
    const block = userRequestBlock(userTask);

    assert.match(block, /<user-request>\nTask RT-100-001: Refine the export\nFocus on the CSV limits\.\n<\/user-request>/);
    assert.match(block, /<acceptance-criteria>\nLimits are listed\n<\/acceptance-criteria>/);
    assert.ok(block.endsWith(CHECK_EACH_CRITERION));
  });

  it("take the description as a goal task's goal", () => {
    assert.equal(goalTextOf(userTask, "Limits are listed"), "Focus on the CSV limits.");
  });

  it("leave other tasks' messages as they were", () => {
    assert.equal(userRequestBlock(scheduledGoal), "");
    assert.equal(acceptanceCriteriaBlock(scheduledGoal), "");
    assert.equal(goalTextOf(scheduledGoal, "Look around"), "Look around");
  });
});
