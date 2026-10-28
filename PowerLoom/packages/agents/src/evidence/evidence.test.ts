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
  const result = await tool.handler({ path: "POS/src/Consumer.cs" });

  return result.text;
}

describe("recordReads", () => {
  it("ends each successful result with its source id", async () => {
    const log = new ReadLog("task message");

    const text = await readOnce(log, "totalActive -= 1;");

    assert.equal(text, "totalActive -= 1;\n\n[source S1]");
    assert.match(log.find("S1")?.text ?? "", /POS\/src\/Consumer\.cs[\s\S]*totalActive -= 1;/);
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
      { source: "S1", ref: "POS/src/Consumer.cs:2 (Consume)", note: "lowers the counter", quote: "totalActive  -= 1;" },
      { source: "s0", ref: "Q-30691-002", note: "the user's answer" },
    ], log);

    assert.deepEqual(problems, []);
  });

  it("rejects a source the run never read", () => {
    const log = new ReadLog("task message");

    const problems = evidenceProblems([{ source: "S7", ref: "POS/src/Invented.cs:10", note: "made up" }], log);

    assert.deepEqual(problems, ['"POS/src/Invented.cs:10" cites S7, which this run never read: read it and cite the source id that read ends with, or remove this evidence item (keep the claim only as (inferred), citing the sources you did read that it rests on)']);
  });

  it("rejects a quote that isn't in the cited source", async () => {
    const log = new ReadLog("task message");

    await readOnce(log, "totalActive -= 1;");

    const problems = evidenceProblems([{ source: "S1", ref: "POS/src/Consumer.cs:2", note: "resets", quote: "totalActive = 0;" }], log);

    assert.deepEqual(problems, ['the quote for "POS/src/Consumer.cs:2" is not in S1: copy it exactly or leave it out']);
  });

  it("accepts a web page the run fetched, and refuses one it never saw", () => {
    const log = new ReadLog("task message");
    const at = new Date();

    log.observe({ type: "tool_call", runId: "r", seq: 1, at, callId: "c1", name: "WebFetch", input: { url: "https://learn.microsoft.com/azure/cosmos-db/time-to-live" } } as never);
    log.observe({ type: "tool_result", runId: "r", seq: 2, at, callId: "c1", output: "TTL: when DefaultTimeToLive is -1, items don't expire unless they set ttl.", isError: false } as never);

    const fetched = evidenceProblems([{ source: "web", ref: "https://learn.microsoft.com/azure/cosmos-db/time-to-live/", note: "TTL semantics", quote: "items don't expire unless they set ttl" }], log);
    const unseen = evidenceProblems([{ source: "web", ref: "https://example.com/blog", note: "made up" }], log);

    assert.deepEqual(fetched, []);
    assert.match(unseen[0], /no web search or page read of this run shows that URL/);
  });

  it("accepts a web page PowerLoom's read_web_page read", () => {
    const log = new ReadLog("task message");
    const at = new Date();

    log.observe({ type: "tool_call", runId: "r", seq: 1, at, callId: "c1", name: "read_web_page", input: { url: "https://www.cms.gov/files/a.pdf", offset: 0 } } as never);
    log.observe({ type: "tool_result", runId: "r", seq: 2, at, callId: "c1", output: "AAA03 code 97 means the enrollment is suspended.", isError: false } as never);

    const problems = evidenceProblems([{ source: "web", ref: "https://www.cms.gov/files/a.pdf", note: "AAA03 97", quote: "enrollment is suspended" }], log);

    assert.deepEqual(problems, []);
  });
});
