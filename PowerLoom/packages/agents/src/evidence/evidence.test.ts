import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { defineTool } from "@agenttools/runtime";
import { z } from "zod";
import { evidenceProblems } from "./evidenceProblems";
import { ReadLog } from "./ReadLog";
import { recordReads } from "./recordReads";

function readFileTool(text: string, isError = false) {
  return defineTool({
    name: "read_file",
    description: "test",
    input: { path: z.string() },
    handler: async () => ({ text, isError }),
  });
}

async function readOnce(log: ReadLog, text: string, isError = false): Promise<string> {
  const [tool] = recordReads([readFileTool(text, isError)], log);
  const result = await tool.handler({ path: "PVS/src/Consumer.cs" });

  return result.text;
}

describe("recordReads", () => {
  it("ends each successful result with its source id", async () => {
    const log = new ReadLog("task message");

    const text = await readOnce(log, "totalActive -= 1;");

    assert.equal(text, "totalActive -= 1;\n\n[source S1]");
    assert.match(log.find("S1")?.text ?? "", /PVS\/src\/Consumer\.cs[\s\S]*totalActive -= 1;/);
  });

  it("logs no source for a failed call", async () => {
    const log = new ReadLog("task message");

    const text = await readOnce(log, "not found", true);

    assert.equal(text, "not found");
    assert.equal(log.find("S1"), undefined);
  });
});

describe("evidenceProblems", () => {
  it("accepts a source the run read, the task message and an exact quote", async () => {
    const log = new ReadLog("Q-30691-002 answered: see the blue alert");

    await readOnce(log, "public void Consume() {\n  totalActive -= 1;\n}");

    const problems = evidenceProblems([
      { source: "S1", ref: "PVS/src/Consumer.cs:2 (Consume)", note: "lowers the counter", quote: "totalActive  -= 1;" },
      { source: "s0", ref: "Q-30691-002", note: "the user's answer" },
    ], log);

    assert.deepEqual(problems, []);
  });

  it("rejects a source the run never read", () => {
    const log = new ReadLog("task message");

    const problems = evidenceProblems([{ source: "S7", ref: "PVS/src/Invented.cs:10", note: "made up" }], log);

    assert.deepEqual(problems, ['"PVS/src/Invented.cs:10" cites S7, which this run never read: read it first, or drop the claim or mark it (inferred)']);
  });

  it("rejects a quote that isn't in the cited source", async () => {
    const log = new ReadLog("task message");

    await readOnce(log, "totalActive -= 1;");

    const problems = evidenceProblems([{ source: "S1", ref: "PVS/src/Consumer.cs:2", note: "resets", quote: "totalActive = 0;" }], log);

    assert.deepEqual(problems, ['the quote for "PVS/src/Consumer.cs:2" is not in S1: copy it exactly or leave it out']);
  });
});
