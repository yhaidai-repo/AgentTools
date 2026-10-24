import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { z } from "zod";
import type { ToolDefinition } from "../../models/ToolDefinition";
import { sdkToolNamer, withSdkToolNaming } from "./toSdkTools";

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

// Run 2542 (2026-10-22) called `read_pbi` as its first message named it and got "No such tool available".
describe("sdkToolNamer", () => {
  const toSdkText = sdkToolNamer([toolNamed("read_pbi"), toolNamed("read_pbi_ref"), toolNamed("search")]);

  it("names every tool with an underscore as the model calls it", () => {
    const text = toSdkText('Read the refinement: read_pbi("PBI-1:refinement"), or read_pbi_ref for one ref.');

    assert.equal(text, 'Read the refinement: mcp__agent__read_pbi("PBI-1:refinement"), or mcp__agent__read_pbi_ref for one ref.');
  });

  it("leaves prefixed names, longer words and plain-word tool names as they are", () => {
    const text = "mcp__agent__read_pbi works; read_pbis, pre_read_pbi and read_pbi-like stay; search stays.";

    assert.equal(toSdkText(text), text);
  });

  it("changes nothing for a run whose tools have no underscore", () => {
    assert.equal(sdkToolNamer([toolNamed("search")])("call read_pbi"), "call read_pbi");
  });
});
