import assert from "node:assert/strict";
import { it } from "node:test";
import { renameStoredAgent, renameToolOffer } from "./renameStoredValues";

it("moves identifiers in saved agents and their shipped snapshot, preserving user settings", () => {
  const settings = {
    enabled: true, schedule: "*/2 * * * *", model: { provider: "custom", model: "mine" },
    limits: { maxTurns: 72 }, budgets: { dailyUsd: 4 }, options: { batchSize: 3, custom: "support-guide" },
  };
  const original = {
    ...settings, id: "support-guide", handles: ["support-guide"], canAssign: ["research", "support-guide"],
    skills: ["powerloom-support-guide", "custom-skill"],
    capabilities: { integrations: { writeSupportGuides: false, readRepos: true } },
    integrationSpecs: [{ key: "writeSupportGuides", owner: "support-guide" }],
    shipped: { handles: ["support-guide"], skills: ["powerloom-support-guide"], prompt: "a-file-hash" },
    prompt: "Custom: load powerloom-support-guide and call write_support_guide.",
  };
  const renamed = renameStoredAgent(original);

  assert.deepEqual(renamed, {
    ...settings, id: "demonstration", handles: ["demonstration"], canAssign: ["research", "demonstration"],
    skills: ["powerloom-demonstration", "custom-skill"],
    capabilities: { integrations: { writeDemonstrations: false, readRepos: true } },
    integrationSpecs: [{ key: "writeDemonstrations", owner: "demonstration" }],
    shipped: { handles: ["demonstration"], skills: ["powerloom-demonstration"], prompt: "a-file-hash" },
    prompt: "Custom: load powerloom-demonstration and call write_demonstration.",
  });
  assert.deepEqual(renameStoredAgent(renamed), renamed);
  assert.deepEqual(renameStoredAgent({ id: "custom", prompt: null }), { id: "custom", prompt: null });
});

it("renames remembered tool offers and only the exact shipped tool summary", () => {
  const offer = {
    holder: "support-guide", tools: [
      { name: "write_support_guide", summary: "Save a structured support guide checkpoint." },
      { name: "custom", summary: "A support guide with my notes." },
    ],
  };
  const renamed = renameToolOffer(offer);

  assert.deepEqual(renamed, {
    holder: "demonstration", tools: [
      { name: "write_demonstration", summary: "Save a structured demonstration guide checkpoint." },
      offer.tools[1],
    ],
  });
  assert.deepEqual(renameToolOffer(renamed), renamed);
  assert.deepEqual(renameToolOffer({ holder: "support-guide" }), { holder: "demonstration" });
  assert.deepEqual(renameStoredAgent({ id: "powerloom-support-guide" }), { id: "powerloom-support-guide" });
});

it("keeps identifier domains separate for custom agents and task kinds", () => {
  const custom = {
    id: "powerloom-support-guide", handles: ["powerloom-support-guide"],
    canAssign: ["powerloom-support-guide", "support-guide-result"],
    skills: ["support-guide", "writeSupportGuides"],
    integrationSpecs: [{ key: "support-guide", owner: "powerloom-support-guide" }],
    shipped: { handles: ["powerloom-support-guide"], skills: ["support-guide"] },
    capabilities: { integrations: { "support-guide": false } },
  };
  assert.deepEqual(renameStoredAgent(custom), custom);
  const offer = { holder: "powerloom-support-guide", tools: [{ name: "powerloom-support-guide", summary: "Custom tool", source: "support-guide" }] };
  assert.deepEqual(renameToolOffer(offer), offer);
});
