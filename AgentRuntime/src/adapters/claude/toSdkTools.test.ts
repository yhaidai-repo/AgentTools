import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { z } from "zod";
import type { ToolDefinition } from "../../models/ToolDefinition";
import { withSdkToolNaming } from "./toSdkTools";

function toolNamed(name: string): ToolDefinition<any> {
  return { name, description: "", input: { ref: z.string() }, handler: async () => ({ text: "" }) } as unknown as ToolDefinition<any>;
}

describe("withSdkToolNaming", () => {
  it("tells the model the prefixed names of the prompt's tools", () => {
    const prompt = withSdkToolNaming("## Your tools\n- list_branches: Branches", [toolNamed("list_branches")]);

    assert.equal(prompt, "## Your tools\n- list_branches: Branches\n\nTools named in this prompt without a prefix are called as `mcp__agent__<name>`, e.g. `mcp__agent__list_branches`.");
  });

  it("leaves a run without tools as it is", () => {
    assert.equal(withSdkToolNaming("Answer.", []), "Answer.");
  });
});
