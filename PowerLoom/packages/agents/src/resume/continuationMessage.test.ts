import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { continuationMessage } from "./continuationMessage";
import type { PreviousRunFacts } from "./models/PreviousRunFacts";

const budgetStop = { id: 1957, outcome: "budget-exceeded", error: "budget-exceeded", conversationId: "c-1" } as never;
const restart = { id: 1960, outcome: "failed", error: "Interrupted: the agent-runner stopped during the run", conversationId: "c-2" } as never;
const limits = { maxTurns: 60, timeoutMs: 30 * 60_000 };
const before: PreviousRunFacts = { maxTurns: 60, timeoutMs: 30 * 60_000, budgetUsd: 1, spentUsd: 1.02, committed: false };
const nothingReplayed = { replayed: {}, restored: 0, failed: [] };

describe("the continuation note", () => {
  it("says why the run stopped, what it spent and that the budget was raised", () => {
    const message = continuationMessage(budgetStop, before, limits, 2, nothingReplayed);

    assert.match(message, /RUN-1957\) stopped before it finished: it reached its budget \(\$1\.02 spent\)\./);
    assert.match(message, /fresh limits: up to 60 turns, 30 minutes and \$2\.00 \(the last run had \$1\.00\)\./);
  });

  it("passes the error on for a failed run", () => {
    const message = continuationMessage(restart, before, limits, 1, nothingReplayed);

    assert.match(message, /it failed: Interrupted: the agent-runner stopped during the run\./);
    assert.doesNotMatch(message, /the last run had/);
  });

  it("lists the restored calls and the ones to make again", () => {
    const message = continuationMessage(restart, before, limits, 1, { replayed: { record_decision: 6, fix_link: 2 }, restored: 0, failed: ["fix_link: note gone"] });

    assert.match(message, /restored by making your earlier calls again: record_decision ×6, fix_link ×2\./);
    assert.match(message, /make them again if they still apply:\n- fix_link: note gone/);
  });

  it("names what a budget stop already saved and asks for the complete result again", () => {
    const saved = { id: 1957, outcome: "budget-exceeded", error: null, conversationId: "c-1", outputs: ["RT-100-002", "HT-100-003"] } as never;
    const message = continuationMessage(saved, { ...before, committed: true }, limits, 2, nothingReplayed);

    assert.match(message, /saved when that run stopped \(RT-100-002, HT-100-003\); use those ids/);
    assert.match(message, /starts with an empty draft: call your result tool again with the complete result/);
    assert.doesNotMatch(message, /restored by making your earlier calls again/);
  });
});
