import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { RunListRow } from "../models/RunListRow";
import { runExportOf } from "./runExport";

describe("runExportOf", () => {
  it("keeps every trace event whole, with the name and summary the run page shows", () => {
    const found = { run: { id: 7, itemId: "TT-1-001" }, task: null } as unknown as Pick<RunListRow, "run" | "task">;
    const output = "x".repeat(5000);
    const trace = [
      { runId: "7", seq: 1, at: new Date(0), type: "tool_call", payload: { name: "item_delete", input: { itemId: "TT-1-001" } } },
      { runId: "7", seq: 2, at: new Date(0), type: "tool_result", payload: { output, isError: true } },
    ];

    const exported = runExportOf(found, null, trace, [], new Date(1));

    assert.equal(exported.trace[0].name, "item_delete");
    assert.equal(exported.trace[0].summary, '{"itemId":"TT-1-001"}');
    assert.equal(exported.trace[1].payload.output, output);
    assert.equal(exported.run.id, 7);
  });
});
