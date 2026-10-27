import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { defineTool } from "@agenttools/runtime";
import { z } from "zod";
import { limitNote, withLimitNotes } from "./limitNotes";

describe("limit notes", () => {
  it("show the turns and the spend under 80% and ask for the result from 80% of either", () => {
    assert.equal(limitNote({ turns: 12, maxTurns: 60, spentUsd: 0.5, budgetUsd: 2 }, "write_result"), "[turns: about 12 of 60; budget: $0.50 of $2.00 used, 25%]");
    assert.equal(limitNote({ turns: 50, maxTurns: 60, spentUsd: 0.5, budgetUsd: 2 }, "write_result"), "[turns: about 50 of 60; budget: $0.50 of $2.00 used, 25%] Write your result now with write_result (status partial if you aren't done); the run stops at its limit.");
    assert.match(limitNote({ turns: 1, maxTurns: 60, spentUsd: 1.7, budgetUsd: 2 }, "write_result"), /85%\] Write your result now/);
  });

  it("leave the budget out when the agent has none", () => {
    assert.equal(limitNote({ turns: 3, maxTurns: 40, spentUsd: 4, budgetUsd: 0 }, "write_result"), "[turns: about 3 of 40]");
  });

  it("end every tool result with the note, read when the tool returns", async () => {
    let turns = 2;
    const tool = defineTool({ name: "read_file", description: "t", input: { path: z.string() }, handler: async () => ({ text: "1: x" }) });
    const [noted] = withLimitNotes([tool], () => ({ turns, maxTurns: 10, spentUsd: 0, budgetUsd: 0 }), "write_result");

    const first = await noted.handler({ path: "a" });

    turns = 9;

    const second = await noted.handler({ path: "a" });

    assert.equal(first.text, "1: x\n[turns: about 2 of 10]");
    assert.match(second.text, /about 9 of 10\] Write your result now/);
  });
});
