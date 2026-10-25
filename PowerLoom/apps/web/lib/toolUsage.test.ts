import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ALL_AGENTS, toolsOfAgent, type ToolCatalogRow } from "./toolUsage";

function row(name: string, holders: string[], calls: number): ToolCatalogRow {
  return { name, summary: "", source: "Every agent", holders, calls, failed: 0, lastUsed: null };
}

describe("toolsOfAgent", () => {
  const rows = [row("write_result", ["better-research", "design"], 0), row("sql_query", ["chat"], 0), row("azure_storage_list", [], 2)];

  it("keeps every tool for all agents", () => {
    assert.equal(toolsOfAgent(rows, ALL_AGENTS).length, 3);
  });

  it("keeps the chosen agent's tools, used or not, and what it called", () => {
    assert.deepEqual(toolsOfAgent(rows, "design").map((entry) => entry.name), ["write_result", "azure_storage_list"]);
  });
});
