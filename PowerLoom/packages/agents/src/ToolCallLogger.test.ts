import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AgentEvent } from "@agenttools/runtime";
import { z } from "zod";
import type { DataAccessLog } from "./DataAccessLog";
import type { DataAccessEntry } from "./models/DataAccessEntry";
import { defineOutsideTool } from "./outsideAccess";
import { ToolCallLogger } from "./ToolCallLogger";

const context = { vault: "work-projects", agentId: "research", runId: 7, taskId: "AT-1-001", pbiId: 1 };
const base = { runId: "7", seq: 0, at: new Date("2026-10-13T10:00:00Z") };

function fakeLog(): { log: DataAccessLog; entries: DataAccessEntry[] } {
  const entries: DataAccessEntry[] = [];

  return { log: { record: async (entry: DataAccessEntry) => { entries.push(entry); } } as unknown as DataAccessLog, entries };
}

function call(callId: string, name: string, input: unknown): AgentEvent {
  return { ...base, type: "tool_call", callId, name, input };
}

function result(callId: string, output: string, isError = false): AgentEvent {
  return { ...base, at: new Date("2026-10-13T10:00:02Z"), type: "tool_result", callId, output, isError };
}

describe("ToolCallLogger", () => {
  it("logs any tool from its call and result, classified by name, with the duration", async () => {
    const { log, entries } = fakeLog();
    const logger = new ToolCallLogger(log, context);

    await logger.observe(call("c1", "read_file", { repo: "PVS", path: "src/a.cs" }));
    await logger.observe(call("c2", "brand_new_tool", { anything: 1 }));
    await logger.observe(result("c1", "file text"));
    await logger.observe(result("c2", "boom", true));

    assert.equal(entries.length, 2);
    assert.deepEqual({ ...entries[0], startedAt: undefined }, { ...context, kind: "repo", resource: "PVS", target: "read_file", request: "src/a.cs", tool: "read_file", outcome: "ok", reason: null, rows: null, bytes: 9, truncated: false, startedAt: undefined, durationMs: 2000 });
    assert.deepEqual([entries[1].kind, entries[1].resource, entries[1].request, entries[1].outcome, entries[1].reason], ["other", "brand_new_tool", '{"anything":1}', "failed", "boom"]);
  });

  it("skips the outside-read tools, which log themselves, and names web and docs calls", async () => {
    const { log, entries } = fakeLog();
    const logger = new ToolCallLogger(log, context);

    defineOutsideTool({ log, requests: { request: async () => ({ id: "HT-1-001", created: true }) } }, context, { name: "sql_query", description: "t", input: { sql: z.string() }, resource: () => ({ kind: "sql", resource: "pvs-dev", target: "db" }), request: (input) => input.sql, handler: async () => ({ text: "" }) });

    await logger.observe(call("s1", "sql_query", { sql: "SELECT 1" }));
    await logger.observe(result("s1", "rows"));
    await logger.observe(call("w1", "WebFetch", { url: "https://learn.microsoft.com/x" }));
    await logger.observe(result("w1", "page"));
    await logger.observe(call("d1", "read_doc", { path: "adoa/x.md" }));
    await logger.observe(result("d1", "note"));

    assert.deepEqual(entries.map((entry) => [entry.tool, entry.kind, entry.resource, entry.request]), [
      ["WebFetch", "web", "learn.microsoft.com", "https://learn.microsoft.com/x"],
      ["read_doc", "docs", "docs", "adoa/x.md"],
    ]);
  });

  it("logs a call without a result as failed when the run ends", async () => {
    const { log, entries } = fakeLog();
    const logger = new ToolCallLogger(log, context);

    await logger.observe(call("c1", "search_code", { repo: "PVS", pattern: "Signal" }));
    await logger.flush();

    assert.equal(entries[0].outcome, "failed");
    assert.equal(entries[0].reason, "no result: the run ended");
  });
});
