import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { composePrompt, loadAgentPrompt, loadPrompt } from "./prompts";

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
    const prompt = await loadPrompt("design", { team: "Signals" });

    assert.equal(prompt.version, "v8");
    assert.doesNotMatch(prompt.text, /How you work/);
  });

  it("gives the autotest prompt the continue and create_task rules", async () => {
    const prompt = await loadPrompt("autotest", { team: "Signals" });

    assert.match(prompt.version, /^v10\+framework\./);
    assert.match(prompt.text, /Each bug in `<bugs-to-retest>` is a case too/);
    assert.match(prompt.text, /Before asking the user for test data, search the database/);
    assert.match(prompt.text, /## Continuing from a previous report/);
    assert.match(prompt.text, /An API criterion is proven with `http_request` alone/);
    assert.match(prompt.text, /a cancelled one is the user's decision not to do it/);
    assert.match(prompt.text, /The branch the task names is started as named/);
    assert.match(prompt.text, /The background host runs \*\*no\*\* worker unless `start_stack`'s `config` names it/);
  });
});

describe("loadAgentPrompt", () => {
  it("runs a stored prompt, versioned by its content, with the framework filled in", async () => {
    const prompt = await loadAgentPrompt("security-review", ["{{framework}}", "", "Review {{team}} for secrets."].join("\n"), { team: "Signals" });

    assert.match(prompt.version, /^stored\.[0-9a-f]{8}\+framework\./);
    assert.match(prompt.text, /How you work/);
    assert.match(prompt.text, /Review Signals for secrets\./);
  });

  it("falls back to the agent's prompt file while the stored prompt is empty", async () => {
    const prompt = await loadAgentPrompt("design", "  ", { team: "Signals" });

    assert.equal(prompt.version, "v8");
  });

  it("gives an agent with neither the framework alone", async () => {
    const prompt = await loadAgentPrompt("made-in-the-ui", "", { team: "Signals" });

    assert.match(prompt.version, /^none\+framework\./);
    assert.match(prompt.text, /How you work/);
  });
});
