import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { defineTool } from "@agenttools/runtime";
import { z } from "zod";
import { budgetNote, withBudgetNotes } from "./budgetNotes";

describe("budget notes", () => {
  it("show the spend under 80% and ask for the result from 80%", () => {
    assert.equal(budgetNote(0.5, 2, "write_research_result"), "[budget: $0.50 of $2.00 used, 25%]");
    assert.equal(budgetNote(1.7, 2, "write_research_result"), "[budget: $1.70 of $2.00 used, 85%] Write your result now with write_research_result (status partial if you aren't done); the run stops at 100%.");
  });

  it("end every tool result with the note, read when the tool returns", async () => {
    let spent = 0.2;
    const tool = defineTool({ name: "read_file", description: "t", input: { path: z.string() }, handler: async () => ({ text: "1: x" }) });
    const [noted] = withBudgetNotes([tool], () => spent, 1, "write_research_result");

    const first = await noted.handler({ path: "a" });

    spent = 0.9;

    const second = await noted.handler({ path: "a" });

    assert.equal(first.text, "1: x\n[budget: $0.20 of $1.00 used, 20%]");
    assert.match(second.text, /90%\] Write your result now/);
  });
});
