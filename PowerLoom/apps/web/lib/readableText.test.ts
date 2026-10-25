import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readableMarkdown } from "./readableText";

describe("readableMarkdown", () => {
  it("turns literal \\n into line breaks when the text has no real one", () => {
    assert.equal(readableMarkdown("Open the portal.\\n\\n- check A\\n- check B"), "Open the portal.\n\n- check A\n- check B");
  });

  it("leaves a literal \\n alone in text that has real line breaks (e.g. inside code)", () => {
    const text = "Run:\n\n```kql\nprint \"a\\nb\"\n```";

    assert.equal(readableMarkdown(text), text);
  });

  it("links PBI mentions, but not inside code or an existing link", () => {
    assert.equal(readableMarkdown("Blocks PBI-30270 and `PBI-1` and [PBI-2](/pbis/2)"), "Blocks [PBI-30270](/pbis/30270) and `PBI-1` and [PBI-2](/pbis/2)");
  });
});
