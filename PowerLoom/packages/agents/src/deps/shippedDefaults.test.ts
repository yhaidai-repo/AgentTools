import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";
import { AGENT_DEFAULTS, GLOBAL_DEFAULTS } from "../agentDefaults";
import { shippedPromptText } from "../prompts";
import { withShippedFields, withShippedFramework } from "./shippedDefaults";

function hashOf(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

describe("withShippedFields", () => {
  it("records each system agent's prompt file as the hash of its LF text, and none for an agent without one", async () => {
    const shipped = await withShippedFields(AGENT_DEFAULTS);
    const design = shipped.find((agent) => agent.id === "design")!;
    const chat = shipped.find((agent) => agent.id === "chat")!;

    assert.equal(design.shipped?.prompt, hashOf((await shippedPromptText("design"))!));
    assert.equal((await shippedPromptText("design"))!.includes("\r\n"), false);
    assert.equal(chat.shipped?.prompt, "");
  });

  it("records the code-owned fields as the definitions ship them", async () => {
    const [first] = await withShippedFields(AGENT_DEFAULTS);

    assert.deepEqual([first.shipped?.label, first.shipped?.skills, first.shipped?.handles], [AGENT_DEFAULTS[0].label, AGENT_DEFAULTS[0].skills, AGENT_DEFAULTS[0].handles]);
  });
});

describe("withShippedFramework", () => {
  it("records the framework file's hash on the global defaults", async () => {
    const global = await withShippedFramework(GLOBAL_DEFAULTS);

    assert.equal(global.shippedFramework, hashOf((await shippedPromptText("_framework"))!));
    assert.equal(global.dailyBudgetUsd, GLOBAL_DEFAULTS.dailyBudgetUsd);
  });
});
