import assert from "node:assert/strict";
import { it } from "node:test";
import { fileURLToPath } from "node:url";
import type { AgentDefinition } from "@agenttools/config";
import { AGENT_DEFAULTS } from "../agentDefaults";
import type { AgentDeps } from "../models/AgentDeps";
import { loadStageSkills } from "../stage";
import { migrateReviewSkills } from "./migrateReviewSkills";

function storedAgent(): AgentDefinition {
  return { ...structuredClone(AGENT_DEFAULTS.find(agent => agent.id === "better-review")!), skills: ["powerloom-better-review", "powerloom-code-review", "pvs-code-style"] };
}

it("upgrades saved skills while preserving a concurrent limits edit and remains idempotent", async () => {
  let stored = storedAgent();
  let saves = 0;
  const store = {
    get: async () => structuredClone(stored),
    saveIfUnchanged: async (current: AgentDefinition, next: AgentDefinition) => {
      saves++;
      if (saves === 1) {
        stored = { ...stored, limits: { ...stored.limits, maxTurns: 123 } };
        return false;
      }
      assert.deepEqual(current, stored);
      stored = next;
      return true;
    },
  };

  await migrateReviewSkills(store);
  assert.deepEqual(stored.skills, ["powerloom-code-review", "pvs-code-style"]);
  assert.equal(stored.limits.maxTurns, 123);
  await migrateReviewSkills(store);
  assert.equal(saves, 2);
});

it("keeps a custom prompt's legacy skill and grants the canonical skill its redirect needs", async () => {
  let stored = { ...storedAgent(), skills: ["powerloom-better-review", "pvs-code-style"], prompt: "Load powerloom-better-review for this custom workflow." };
  const originalPrompt = stored.prompt;
  const store = {
    get: async () => structuredClone(stored),
    saveIfUnchanged: async (_current: AgentDefinition, next: AgentDefinition) => { stored = { ...next, prompt: next.prompt! }; return true; },
  };
  await migrateReviewSkills(store);
  assert.deepEqual(stored.skills, ["powerloom-better-review", "pvs-code-style", "powerloom-code-review"]);
  assert.equal(stored.prompt, originalPrompt);
  await migrateReviewSkills(store);
  assert.equal(stored.skills.length, 3);
});

it("lets an older legacy-only configuration load the redirect's canonical instructions", async () => {
  const agent = { ...storedAgent(), skills: ["powerloom-better-review"] };
  const deps = { skillFolders: [fileURLToPath(new URL("../../../../skills", import.meta.url))] } as AgentDeps;
  const loaded = await loadStageSkills(deps, agent, null);
  const tool = loaded.tools.find(tool => tool.name === "use_skill")!;

  const alias = await tool.handler({ name: "powerloom-better-review" });
  const canonical = await tool.handler({ name: "powerloom-code-review" });
  assert.notEqual(alias.isError, true);
  assert.notEqual(canonical.isError, true);
  assert.match(canonical.text, /# Code review/);
});
