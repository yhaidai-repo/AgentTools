import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { localItem } from "@powerloom/db";
import { noRepos } from "../repos/openRepos";
import { buildTaskResearchMessage } from "./researchMessage";

type ItemRow = typeof localItem.$inferSelect;

describe("buildTaskResearchMessage", () => {
  it("gives a task without a PBI its question, the user's criteria and the repos block, like any research task", () => {
    const task = {
      id: "GT-001",
      title: "Tools test",
      body: "Does every read tool available to this agent work?",
      data: { createdBy: "user", doneWhen: "Each tool tested and the result logged", goal: "Each tool tested and the result logged", repos: [] },
    } as unknown as ItemRow;

    const message = buildTaskResearchMessage(task, noRepos());

    assert.match(message, /^Answer this research task\. It belongs to no PBI\./);
    assert.match(message, /Question: Does every read tool available to this agent work\?/);
    assert.match(message, /Goal: Each tool tested and the result logged/);
    assert.match(message, /Created by the user: the goal holds the acceptance criteria/);
    assert.match(message, /<repos>\nnone: Read repositories is off/);
  });
});
