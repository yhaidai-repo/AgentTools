import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { DataAccessCall } from "../models/DataAccessCall";
import { EVERY_AGENT, SEEN_IN_CALLS_ONLY, toolCatalog } from "./toolCatalog";

function call(tool: string, outcome: string): DataAccessCall {
  return { tool, outcome, agentId: "chat" } as DataAccessCall;
}

describe("toolCatalog", () => {
  it("lists every offered tool once with its holders, unused ones included, and tools only seen in calls last", () => {
    const offers = [
      { holder: "better-research", offeredAt: "", tools: [{ name: "write_result", summary: "Record the result.", source: EVERY_AGENT }, { name: "sql_query", summary: "Run one query.", source: "Read SQL (SQL Server)" }] },
      { holder: "chat", offeredAt: "", tools: [{ name: "sql_query", summary: "Run one query.", source: "Read SQL (SQL Server)" }, { name: "pbi_read", summary: "Read a PBI.", source: "PowerLoom commands" }] },
    ];
    const latest = new Map([["sql_query", new Date("2026-10-25T08:00:00Z")]]);

    const rows = toolCatalog(offers, [call("sql_query", "ok"), call("sql_query", "failed"), call("azure_storage_list", "ok")], latest);

    assert.deepEqual(rows.map((row) => [row.name, row.source, row.holders.join(","), row.calls, row.failed]), [
      ["write_result", EVERY_AGENT, "better-research", 0, 0],
      ["pbi_read", "PowerLoom commands", "chat", 0, 0],
      ["sql_query", "Read SQL (SQL Server)", "better-research,chat", 2, 1],
      ["azure_storage_list", SEEN_IN_CALLS_ONLY, "", 1, 0],
    ]);
    assert.deepEqual(rows.find((row) => row.name === "sql_query")?.lastUsed, new Date("2026-10-25T08:00:00Z"));
    assert.equal(rows.find((row) => row.name === "write_result")?.lastUsed, null);
  });
});
