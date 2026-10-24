import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { z } from "zod";
import type { PowerLoomDb } from "@powerloom/db";
import { DataAccessLog } from "./DataAccessLog";
import type { DataAccessEntry } from "./models/DataAccessEntry";
import { defineOutsideTool, outcomeOf } from "./outsideAccess";

const context = { vault: "work-projects", agentId: "research", runId: 42, owner: "powerloom-run-42", taskId: "AT-1-001", pbiId: 1 };

function fakeLog(): { log: DataAccessLog; entries: DataAccessEntry[] } {
  const entries: DataAccessEntry[] = [];

  return { log: { record: async (entry: DataAccessEntry) => { entries.push(entry); } } as unknown as DataAccessLog, entries };
}

const noRequests = { request: async () => ({ id: "HT-1-001", created: true }) };

function tool(log: DataAccessLog, handler: () => Promise<{ text: string; isError?: boolean; refusal?: string; denied?: boolean; rows?: number; truncated?: boolean }>, requests = noRequests) {
  return defineOutsideTool({ log, requests }, context, {
    name: "sql_query",
    description: "test",
    input: { connection: z.string(), sql: z.string() },
    resource: (input) => ({ kind: "sql", resource: input.connection, target: "db1/Pvs" }),
    request: (input) => input.sql,
    handler,
  });
}

describe("defineOutsideTool", () => {
  it("logs who, where, the request, the counts and ok, and hands the agent only the text", async () => {
    const { log, entries } = fakeLog();
    const defined = tool(log, async () => ({ text: "| a |\n| 1 |", rows: 1, truncated: false }));

    const result = await defined.handler({ connection: "pvs-dev", sql: "SELECT 1" });

    assert.deepEqual(result, { text: "| a |\n| 1 |", isError: undefined });
    assert.equal(entries.length, 1);
    assert.deepEqual({ ...entries[0], startedAt: undefined, durationMs: undefined }, {
      ...context, kind: "sql", resource: "pvs-dev", target: "db1/Pvs", tool: "sql_query", request: "SELECT 1", outcome: "ok", reason: null, rows: 1, bytes: 11, truncated: false, startedAt: undefined, durationMs: undefined,
    });
  });

  it("logs a thrown error as failed and still answers the agent", async () => {
    const { log, entries } = fakeLog();
    const defined = tool(log, async () => { throw new Error("socket hang up"); });

    const result = await defined.handler({ connection: "pvs-dev", sql: "SELECT 1" });

    assert.equal(result.isError, true);
    assert.equal(entries[0].outcome, "failed");
    assert.equal(entries[0].reason, "The tool failed: socket hang up");
  });

  it("never fails the tool when the log can't be written", async () => {
    const db = { insert: () => ({ values: async () => { throw new Error("db down"); } }) } as unknown as PowerLoomDb;
    const defined = tool(new DataAccessLog(db), async () => ({ text: "fine" }));
    const quiet = console.error;

    console.error = () => undefined;

    try {
      assert.deepEqual(await defined.handler({ connection: "pvs-dev", sql: "SELECT 1" }), { text: "fine", isError: undefined });
    } finally {
      console.error = quiet;
    }
  });
});

describe("defineOutsideTool on a denied call", () => {
  it("asks for access once, names the task to the agent and logs denied", async () => {
    const { log, entries } = fakeLog();
    const asked: unknown[] = [];
    const requests = { request: async (...args: unknown[]) => { asked.push(args); return { id: "HT-1-002", created: true }; } };
    const defined = tool(log, async () => ({ text: "Login failed for user 'reader'.", isError: true, denied: true }), requests);

    const result = await defined.handler({ connection: "pvs-dev", sql: "SELECT 1" });

    assert.equal(result.isError, true);
    assert.match(result.text, /Task HT-1-002 asks a person to fix it, and your task runs again once it's closed/);
    assert.equal(asked.length, 1);
    assert.deepEqual(asked[0], [context, { kind: "sql", resource: "pvs-dev", target: "db1/Pvs" }, "sql_query", "Login failed for user 'reader'."]);
    assert.equal(entries[0].outcome, "denied");
  });

  it("keeps the refusal readable when the request can't be written", async () => {
    const { log } = fakeLog();
    const requests = { request: async () => { throw new Error("db down"); } };
    const defined = tool(log, async () => ({ text: "401", isError: true, denied: true }), requests);
    const quiet = console.error;

    console.error = () => undefined;

    try {
      assert.match((await defined.handler({ connection: "pvs-dev", sql: "SELECT 1" })).text, /no task could be created/);
    } finally {
      console.error = quiet;
    }
  });
});

describe("outcomeOf", () => {
  it("tells refused, denied, failed and ok apart", () => {
    assert.deepEqual(outcomeOf({ text: "no", isError: true, refusal: "Read only: DELETE isn't allowed" }), { outcome: "refused", reason: "Read only: DELETE isn't allowed" });
    assert.deepEqual(outcomeOf({ text: "Login failed for user 'reader'.", isError: true, denied: true }), { outcome: "denied", reason: "Login failed for user 'reader'." });
    assert.deepEqual(outcomeOf({ text: "timeout", isError: true }), { outcome: "failed", reason: "timeout" });
    assert.deepEqual(outcomeOf({ text: "rows" }), { outcome: "ok", reason: null });
  });
});
