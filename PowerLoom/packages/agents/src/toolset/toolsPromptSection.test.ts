import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ToolDefinition } from "@agenttools/runtime";
import { toolsPromptSection } from "./toolsPromptSection";

function tool(name: string, description: string): ToolDefinition<any> {
  return { name, description } as unknown as ToolDefinition<any>;
}

describe("toolsPromptSection", () => {
  it("lists every tool with the first sentence of its description", () => {
    const section = toolsPromptSection([tool("read_file", "Read one file of a repo. Paths start with the repo name."), tool("create_task", "Hand work on.")]);

    assert.equal(section, [
      "## Your tools",
      "Every tool of this run, as your Config gives them; nothing else exists. Use any of them when it helps.",
      "- read_file: Read one file of a repo.",
      "- create_task: Hand work on.",
    ].join("\n"));
  });

  it("cuts a long first sentence", () => {
    const section = toolsPromptSection([tool("open_repo", `Add a repo of the catalog: ${"x".repeat(200)}`)]);
    const line = section.split("\n").at(-1)!;

    assert.equal(line.length, "- open_repo: ".length + 160);
    assert.ok(line.endsWith("…"));
  });
});
