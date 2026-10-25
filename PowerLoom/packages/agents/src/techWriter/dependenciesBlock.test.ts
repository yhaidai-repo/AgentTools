import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { localItem } from "@powerloom/db";
import { dependenciesOf } from "../tasks/waiting";
import { dependencyBlock } from "./dependenciesBlock";

type ItemRow = typeof localItem.$inferSelect;

function item(fields: Partial<ItemRow>): ItemRow {
  return { id: "AT-004", kind: "research", status: "done", title: "Why do expired catalog stay active?", body: null, resolution: null, parentId: null, data: null, ...fields } as ItemRow;
}

const RESULT = item({
  id: "RR-004",
  kind: "research-result",
  status: "final",
  parentId: "AT-004",
  title: "Result: Why do expired catalog stay active?",
  data: { conclusion: "Nothing archives them.", confidence: "high", findings: ["The job never ran"], evidence: [{ location: "POS/Jobs/Archive.cs:12", note: "no trigger" }], relevantDocs: [], codeRefs: [] },
});

describe("dependenciesOf", () => {
  it("reads the ids the task waits for, none by default", () => {
    assert.deepEqual(dependenciesOf(item({ data: { draft: "x" } })), []);
    assert.deepEqual(dependenciesOf(item({ data: { dependsOn: ["AT-004", "Q-002"] } })), ["AT-004", "Q-002"]);
  });
});

describe("dependencyBlock", () => {
  it("shows a research task with its final results", () => {
    const block = dependencyBlock(item({}), [RESULT, item({ id: "RR-009", kind: "research-result", parentId: "AT-009" })]);

    assert.match(block, /^## AT-004 \(research, done\): Why do expired catalog stay active\?\n## RR-004 for AT-004/);
    assert.match(block, /Conclusion \(high\): Nothing archives them\./);
    assert.doesNotMatch(block, /RR-009/);
  });

  it("shows a question with the user's answer, or that nothing came back", () => {
    const question = item({ id: "Q-002", kind: "question", status: "done", title: "Keep the old names?", resolution: "Yes, keep them." });

    assert.equal(dependencyBlock(question, []), "## Q-002 (question, done): Keep the old names?\nAnswer: Yes, keep them.");
    assert.equal(dependencyBlock(item({ status: "cancelled" }), []), "## AT-004 (research, cancelled): Why do expired catalog stay active?\nNo result was recorded.");
  });
});
