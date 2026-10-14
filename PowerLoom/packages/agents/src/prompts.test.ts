import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { composePrompt, loadPrompt } from "./prompts";

const FRAMEWORK = "<!-- prompt: framework · version: v2 -->\n## How you work\nVerify first.\n";

async function readFramework(name: string): Promise<string> {
  assert.equal(name, "_framework");

  return FRAMEWORK;
}

describe("composePrompt", () => {
  it("inserts the framework and records both versions", async () => {
    const raw = "<!-- prompt: better-research · version: v1 -->\n{{framework}}\n\nYou are research of {{team}}.";

    const prompt = await composePrompt(raw, { team: "Signals" }, readFramework);

    assert.equal(prompt.text, "## How you work\nVerify first.\n\nYou are research of Signals.");
    assert.equal(prompt.version, "v1+framework.v2");
  });

  it("leaves a prompt without the placeholder as it was", async () => {
    const raw = "<!-- prompt: research · version: v10 -->\nYou are research of {{team}}.";
    const unread = async (): Promise<string> => assert.fail("the framework must not be read");

    const prompt = await composePrompt(raw, { team: "Signals" }, unread);

    assert.deepEqual(prompt, { text: "You are research of Signals.", version: "v10" });
  });
});

describe("loadPrompt", () => {
  it("keeps today's prompts unchanged", async () => {
    const prompt = await loadPrompt("research", { team: "Signals" });

    assert.equal(prompt.version, "v13");
    assert.doesNotMatch(prompt.text, /How you work/);
  });
});
