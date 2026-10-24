import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AgentDefinition } from "@agenttools/config";
import type { ToolDefinition } from "@agenttools/runtime";
import { grantSource, offeredTools } from "./toolSources";

function tool(name: string, description: string): ToolDefinition<any> {
  return { name, description, input: {}, handler: async () => ({ text: "" }) } as unknown as ToolDefinition<any>;
}

describe("offeredTools", () => {
  it("lists each tool once with its first sentence and what gave it", () => {
    const groups = [
      { source: "Every agent", tools: [tool("read_doc", "Read a vault note. It returns Markdown.")] },
      { source: "Read SQL (SQL Server)", tools: [tool("sql_query", "Run one query."), tool("read_doc", "Again.")] },
    ];

    assert.deepEqual(offeredTools(groups), [
      { name: "read_doc", summary: "Read a vault note.", source: "Every agent" },
      { name: "sql_query", summary: "Run one query.", source: "Read SQL (SQL Server)" },
    ]);
  });
});

describe("grantSource", () => {
  it("names a grant as the Config page does, or by its key when the agent doesn't list it", () => {
    const agent = { integrationSpecs: [{ key: "readSql", label: "Read SQL (SQL Server)", description: "" }] } as unknown as AgentDefinition;

    assert.equal(grantSource(agent, "readSql"), "Read SQL (SQL Server)");
    assert.equal(grantSource(agent, "somethingNew"), "somethingNew");
  });
});
