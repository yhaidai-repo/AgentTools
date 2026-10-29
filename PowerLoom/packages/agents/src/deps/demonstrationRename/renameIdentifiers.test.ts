import assert from "node:assert/strict";
import { it } from "node:test";
import { renameIdentifier, renameIdentifiers, renamePromptText } from "./renameIdentifiers";

it("renames whole identifiers and nested keys without changing prose or its input", () => {
  const original = {
    id: "support-guide", skills: ["powerloom-support-guide", "custom"],
    nested: { writeSupportGuides: true, values: [null, false, 3, "support-guide-result", "write_support_guide"] },
    description: "A support-guide task stays in history.",
  };
  const before = structuredClone(original);
  const renamed = renameIdentifiers(original);

  assert.deepEqual(renamed, {
    id: "demonstration", skills: ["powerloom-demonstration", "custom"],
    nested: { writeDemonstrations: true, values: [null, false, 3, "demonstration-result", "write_demonstration"] },
    description: original.description,
  });
  assert.deepEqual(original, before);
  assert.deepEqual(renameIdentifiers(renamed), renamed);
  assert.equal(renameIdentifier("agent:support-guide"), "agent:support-guide");
});

it("updates names requested by a custom prompt while retaining its other instructions", () => {
  const text = "Keep my workflow. Load powerloom-support-guide, read support-guide-input, call write_support_guide twice. support-guide history.";
  const renamed = renamePromptText(text);

  assert.equal(renamed, "Keep my workflow. Load powerloom-demonstration, read demonstration-input, call write_demonstration twice. support-guide history.");
  assert.equal(renamePromptText(renamed), renamed);
});

it("refuses conflicting renamed keys rather than silently overwriting a user setting", () => {
  assert.throws(() => renameIdentifiers({ writeSupportGuides: true, writeDemonstrations: false }), /conflicting values/);
  assert.deepEqual(renameIdentifiers({ writeSupportGuides: false, writeDemonstrations: false }), { writeDemonstrations: false });
});
