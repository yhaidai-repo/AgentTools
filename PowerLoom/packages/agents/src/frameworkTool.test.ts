import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getFrameworkCommand, type CommandContext } from "@powerloom/core";
import { createCommandTool } from "./commandTool";

// loadPromptVersions' query: select().from().where().orderBy() resolves to the saved versions.
function dbWith(rows: { version: number; text: string; createdAt: Date }[]) {
  const query = { from: () => query, where: () => query, orderBy: async () => rows };

  return { select: () => query };
}

describe("agent_framework as a chat tool", () => {
  it("shows the version, the source and the saved versions next to the text", async () => {
    const context = {
      db: dbWith([{ version: 2, text: "## Ours v2", createdAt: new Date("2026-10-25T10:00:00Z") }]),
      agents: { getGlobal: async () => ({ paused: false, pausedUntil: null, dailyBudgetUsd: 10, framework: "## Ours v2", frameworkVersion: 2 }) },
    } as unknown as CommandContext;
    const tool = createCommandTool("agent_framework", getFrameworkCommand, context);

    const result = await tool.handler({});
    const shown = JSON.parse(result.text);

    assert.equal(shown.source, "settings");
    assert.equal(shown.version, "ui-v2");
    assert.equal(shown.framework, "## Ours v2");
    assert.deepEqual(shown.history, [{ version: 2, savedAt: "2026-10-25T10:00:00.000Z" }]);
  });
});
