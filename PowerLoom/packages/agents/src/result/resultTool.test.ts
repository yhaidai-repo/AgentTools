import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ReadLog } from "../evidence/ReadLog";
import { RESULT_TOOL, createResultTool } from "./resultTool";
import { RunResult } from "./RunResult";

function toolWithLog() {
  const log = new ReadLog("Task AT-1: the question");
  const source = log.add("The vendor shows as a raw key in VendorList.");
  const result = new RunResult();
  const tool = createResultTool(result, log);

  return { result, tool, source };
}

describe(RESULT_TOOL, () => {
  it("records the latest call as the run's result", async () => {
    const { result, tool } = toolWithLog();

    await tool.handler({ status: "partial", body: "First try", evidence: [] });
    const reply = await tool.handler({ status: "complete", body: "# Done\n\nThe key is shown.", data: { answer: "yes" }, evidence: [] });

    assert.equal(reply.text, "Result recorded (complete).");
    assert.equal(result.isWritten, true);
    assert.deepEqual(result.latest, { status: "complete", body: "# Done\n\nThe key is shown.", data: { answer: "yes" }, evidence: [] });
  });

  it("refuses evidence the run never read and keeps the earlier result", async () => {
    const { result, tool, source } = toolWithLog();

    await tool.handler({ status: "complete", body: "Good", evidence: [{ source, ref: "VendorList.tsx", note: "raw key" }] });
    const reply = await tool.handler({ status: "complete", body: "Bad", evidence: [{ source: "S99", ref: "Nowhere.ts", note: "made up" }] });

    assert.match(reply.text, /Result not recorded/);
    assert.match(reply.text, /S99, which this run never read/);
    assert.equal(result.latest?.body, "Good");
  });

  it("starts without a result", () => {
    const result = new RunResult();

    assert.equal(result.isWritten, false);
    assert.equal(result.latest, null);
  });
});
