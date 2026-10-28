import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ToolDefinition } from "@agenttools/runtime";
import { ownTools } from "./ownTools";

function tool(name: string): ToolDefinition<any> {
  return { name } as unknown as ToolDefinition<any>;
}

describe("ownTools", () => {
  it("drops an own tool a shared tool already has the name of", () => {
    const kept = ownTools([tool("write_plan"), tool("create_task"), tool("create_question")], [tool("read_file"), tool("create_task")]);

    assert.deepEqual(kept.map((item) => item.name), ["write_plan", "create_question"]);
  });
});
