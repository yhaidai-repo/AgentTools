import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mergeGlobal, refreshSystemAgent } from "./defaults";
import type { AgentDefinition } from "./models/AgentDefinition";
import type { AgentsGlobal } from "./models/AgentsGlobal";
import { shippedFieldsOf } from "./shippedFields";

const NOW = new Date("2026-10-30T08:00:00.000Z");
const SHIPPED_SKILLS = new Set(["checklist-v2", "documentation", "checklist-v1"]);

function shippedAgent(changes: Partial<AgentDefinition> = {}, promptHash = "prompt-v2"): AgentDefinition {
  const agent: AgentDefinition = {
    id: "planner",
    label: "Planner",
    description: "Plans one PBI.",
    enabled: true,
    schedule: "0 * * * *",
    model: { provider: "anthropic", model: "claude-opus-5-5", effort: "high" },
    limits: { maxTurns: 60, timeoutMinutes: 20 },
    budgets: { perRunUsd: 3, dailyUsd: 6 },
    capabilities: { webAccess: false, integrations: { readRepos: true }, readCode: true },
    skills: ["checklist-v2"],
    options: { batchSize: 1 },
    canAssign: ["research"],
    handles: ["design"],
    waitFor: ["drafts"],
    optionSpecs: [{ key: "batchSize", label: "Batch", description: "", min: 1, max: 5 }],
    integrationSpecs: [{ key: "readRepos", label: "Repos", description: "" }],
    ...changes,
  };

  return { ...agent, shipped: shippedFieldsOf(agent, promptHash) };
}

// A copy an older version stored and the user then set: their model, effort, switch, budget and an extra skill.
function storedByOlderVersion(changes: Partial<AgentDefinition> = {}): Partial<AgentDefinition> {
  const older = shippedAgent({ description: "Designs one PBI.", skills: ["checklist-v1"], handles: ["design", "old-type"] }, "prompt-v1");

  return {
    ...older,
    enabled: false,
    model: { provider: "anthropic", model: "claude-sonnet-5-5", effort: "medium" },
    budgets: { perRunUsd: 5, dailyUsd: 10 },
    capabilities: { webAccess: true, integrations: { readRepos: false } },
    skills: ["checklist-v1", "project-style"],
    prompt: "An edited prompt.",
    promptVersion: 3,
    ...changes,
  };
}

describe("refreshSystemAgent", () => {
  it("keeps what the user set: switch, model and effort, budgets, web access, integrations", () => {
    const { agent } = refreshSystemAgent(storedByOlderVersion(), shippedAgent(), SHIPPED_SKILLS, NOW);

    assert.equal(agent.enabled, false);
    assert.deepEqual(agent.model, { provider: "anthropic", model: "claude-sonnet-5-5", effort: "medium" });
    assert.deepEqual(agent.budgets, { perRunUsd: 5, dailyUsd: 10 });
    assert.deepEqual(agent.capabilities, { webAccess: true, integrations: { readRepos: false }, readCode: true });
  });

  it("takes what an upgrade ships: description, prompt file, skills, pipeline, keeping a skill the user added", () => {
    const { agent, replaced } = refreshSystemAgent(storedByOlderVersion(), shippedAgent(), SHIPPED_SKILLS, NOW);

    assert.equal(agent.description, "Plans one PBI.");
    assert.deepEqual([agent.prompt, agent.promptVersion], ["", 0]);
    assert.deepEqual(agent.skills, ["checklist-v2", "project-style"]);
    assert.deepEqual(agent.handles, ["design"]);
    assert.deepEqual(replaced, ["description", "prompt", "skills", "handles"]);
    assert.deepEqual(agent.shipped?.note, { fields: replaced, at: NOW.toISOString() });
  });

  it("keeps an edit made after the upgrade until the code changes that field again", () => {
    const upgraded = refreshSystemAgent(storedByOlderVersion(), shippedAgent(), SHIPPED_SKILLS, NOW).agent;
    const edited = { ...upgraded, prompt: "Edited after the upgrade.", promptVersion: 4, skills: ["checklist-v2"] };

    const again = refreshSystemAgent(edited, shippedAgent(), SHIPPED_SKILLS, NOW);
    const next = refreshSystemAgent(edited, shippedAgent({}, "prompt-v3"), SHIPPED_SKILLS, NOW);

    assert.deepEqual([again.agent.prompt, again.agent.skills, again.replaced], ["Edited after the upgrade.", ["checklist-v2"], []]);
    assert.deepEqual([next.agent.prompt, next.agent.promptVersion, next.replaced], ["", 0, ["prompt"]]);
  });

  it("is idempotent: a second start changes nothing and keeps the note", () => {
    const first = refreshSystemAgent(storedByOlderVersion(), shippedAgent(), SHIPPED_SKILLS, NOW).agent;

    const second = refreshSystemAgent(first, shippedAgent(), SHIPPED_SKILLS, new Date("2026-10-31T08:00:00.000Z"));

    assert.deepEqual(second.agent, first);
    assert.deepEqual(second.replaced, []);
  });

  it("tells a user's skill from a dropped shipped one by the record once there is one", () => {
    const upgraded = refreshSystemAgent(storedByOlderVersion(), shippedAgent(), SHIPPED_SKILLS, NOW).agent;
    const withAddition = { ...upgraded, skills: ["checklist-v2", "project-style", "another-own"] };

    const next = refreshSystemAgent(withAddition, shippedAgent({ skills: ["checklist-v3"] }), new Set(["checklist-v3"]), NOW);

    assert.deepEqual(next.agent.skills, ["checklist-v3", "project-style", "another-own"]);
  });

  it("takes every shipped value once from a copy stored before the record, keeping a skill no system agent ships", () => {
    const { shipped: _, ...beforeRecord } = storedByOlderVersion({ skills: ["checklist-v1", "documentation", "project-style"], label: "My planner" });

    const { agent, replaced } = refreshSystemAgent(beforeRecord, shippedAgent(), SHIPPED_SKILLS, NOW);

    assert.deepEqual([agent.label, agent.skills, agent.prompt], ["Planner", ["checklist-v2", "project-style"], ""]);
    assert.deepEqual(replaced, ["label", "description", "prompt", "skills", "handles"]);
  });

  it("doesn't count a list in another order as a replaced value", () => {
    const upgraded = refreshSystemAgent(storedByOlderVersion(), shippedAgent(), SHIPPED_SKILLS, NOW).agent;
    const { shipped: _, ...reordered } = { ...upgraded, waitFor: ["drafts"], canAssign: ["research"], handles: ["design"] };

    const { replaced } = refreshSystemAgent({ ...reordered, canAssign: ["research"] }, shippedAgent({ canAssign: ["research", "design"] }), SHIPPED_SKILLS, NOW);
    const swapped = refreshSystemAgent({ ...reordered, canAssign: ["design", "research"] }, shippedAgent({ canAssign: ["research", "design"] }), SHIPPED_SKILLS, NOW);

    assert.deepEqual(replaced, ["canAssign"]);
    assert.deepEqual(swapped.replaced, []);
  });

  it("adds a new system agent as the code ships it, without a note", () => {
    const { agent, replaced } = refreshSystemAgent({}, shippedAgent(), SHIPPED_SKILLS, NOW);

    assert.deepEqual(replaced, []);
    assert.equal(agent.shipped?.note, undefined);
    assert.deepEqual([agent.model.model, agent.skills, agent.prompt], ["claude-opus-5-5", ["checklist-v2"], ""]);
  });
});

describe("mergeGlobal and the shipped framework", () => {
  const stored: AgentsGlobal = { paused: false, pausedUntil: null, dailyBudgetUsd: 100, framework: "Edited framework.", frameworkVersion: 2, shippedFramework: "framework-v1" };

  it("puts the agents back on a new shipped framework, keeping the budget", () => {
    const merged = mergeGlobal(stored, { ...stored, dailyBudgetUsd: 10, framework: "", frameworkVersion: 0, shippedFramework: "framework-v2" }, NOW);

    assert.deepEqual([merged.framework, merged.frameworkVersion, merged.dailyBudgetUsd], ["", 0, 100]);
    assert.deepEqual([merged.shippedFramework, merged.frameworkReplacedAt], ["framework-v2", NOW.toISOString()]);
  });

  it("keeps an edited framework while the shipped one is unchanged, and when the defaults carry no hash", () => {
    assert.equal(mergeGlobal(stored, { ...stored, shippedFramework: "framework-v1" }, NOW).framework, "Edited framework.");
    assert.equal(mergeGlobal(stored, { paused: false, pausedUntil: null, dailyBudgetUsd: 10 }, NOW).framework, "Edited framework.");
  });
});
