import assert from "node:assert/strict";
import { it } from "node:test";
import { codeReview } from "@powerloom/db";
import type { AgentDeps } from "../models/AgentDeps";
import type { BetterReviewRun } from "./models/BetterReviewRun";
import { commitBetterReview, saveRules } from "./commitBetterReview";
import { parseReviewRules } from "./reviewRules";

function fixture() {
  let note = "# Existing rules\n\nHuman text.\n";
  let failWrite = false;
  let failDb = false;
  let concurrentEdit = false;
  let tail = Promise.resolve();
  const db = {
    select: () => ({ from: (table: unknown) => ({ where: () => Object.assign(Promise.resolve([]), { for: async () => table === codeReview ? [{ id: 7 }] : [] }) }) }),
    update: (table: unknown) => ({ set: () => ({ where: async () => { if (table === codeReview && failDb) throw new Error("synthetic database failure"); } }) }),
    insert: () => ({ values: () => ({ onConflictDoNothing: async () => undefined }) }),
    execute: async () => undefined,
    transaction: (action: (tx: unknown) => Promise<any>) => {
      const result = tail.then(() => action({ ...db, transaction: (nested: (tx: unknown) => Promise<any>) => nested(db) }));
      tail = result.catch(() => undefined);
      return result;
    },
  };
  const deps = { db, docsVaultName: "demo", docsVault: {
    readNote: async () => note,
    appendNote: async (_path: string, suffix: string) => {
      if (failWrite) throw new Error("synthetic note failure");
      if (concurrentEdit) { note += "\nConcurrent human edit.\n"; concurrentEdit = false; }
      note += suffix;
    },
  } } as unknown as AgentDeps;
  const run = { context: { pr: { id: 7, sourceCommit: "head", iteration: 1, origin: "github" }, repo: { name: "Demo" }, rules: { path: "review-rules/Demo.md" }, otherReviews: {} }, checkout: { sourceCommit: "head" }, outdatedIds: [], mode: "full", draft: { comments: [], updates: [], reviewerNotes: [], result: { assessment: "Synthetic", verdict: "ready", goals: [], criteria: [], risks: [], notReviewed: [], businessLogic: "Synthetic" }, rules: [{ kind: "decision", rule: "Synthetic decision", appliesTo: "Demo", reason: "Synthetic", source: "PR 7, RC-7-001", sourceText: "Synthetic answer" }] } } as unknown as BetterReviewRun;
  return { deps, run, note: () => note, failWrite: (value: boolean) => { failWrite = value; }, failDb: (value: boolean) => { failDb = value; }, edit: () => { concurrentEdit = true; } };
}

it("recovers publication after a later review DB failure without duplicating the rule", async () => {
  const state = fixture();
  state.failDb(true);
  state.edit();
  await assert.rejects(commitBetterReview(state.deps, { id: "RT-7" } as any, state.run, 1, []), /database failure/);
  assert.equal(parseReviewRules(state.note()).length, 1);
  state.failDb(false);
  await commitBetterReview(state.deps, { id: "RT-7" } as any, state.run, 2, []);
  assert.equal(parseReviewRules(state.note()).length, 1);
  assert.match(state.note(), /Human text/);
  assert.match(state.note(), /Concurrent human edit/);
});

it("retries a note-write failure and serializes same-decision publication", async () => {
  const state = fixture();
  state.failWrite(true);
  await assert.rejects(saveRules(state.deps, state.run, 1, "RT-7"), /note failure/);
  assert.equal(parseReviewRules(state.note()).length, 0);
  state.failWrite(false);
  const receipts = await Promise.all([saveRules(state.deps, state.run, 1, "RT-7"), saveRules(state.deps, state.run, 2, "RT-7")]);
  assert.deepEqual(receipts.map(receipt => receipt.ids), [["RV-001"], ["RV-001"]]);
  assert.equal(parseReviewRules(state.note()).length, 1);
});
