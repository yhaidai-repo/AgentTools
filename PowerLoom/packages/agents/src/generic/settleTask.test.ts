import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { RunHandoff } from "@powerloom/core";
import type { ResultDraft } from "../result/models/ResultDraft";
import { decideSettlement, type SettlementInput } from "./settleTask";

function result(status: ResultDraft["status"], body = "# Summary line", waitingFor: string[] = []): ResultDraft {
  return { status, body, data: null, evidence: [], waitingFor };
}

function input(overrides: Partial<SettlementInput>): SettlementInput {
  return { outcome: "success", result: result("complete"), handoffs: [], openWaitingFor: [], writers: [], ...overrides };
}

const ask = (toItemId: string): RunHandoff => ({ intent: "ask", toItemId });
const carryOn = (toItemId: string, intent: RunHandoff["intent"] = "continue"): RunHandoff => ({ intent, toItemId });

describe("decideSettlement", () => {
  it("ends a complete run with every promised output done", () => {
    assert.deepEqual(decideSettlement(input({})), { kind: "done" });
  });

  it("blocks a complete run without the output its writer promised", () => {
    const settled = decideSettlement(input({ writers: [{ kind: "missing", output: "a test report (write_test_report)" }] }));

    assert.equal(settled.kind, "block");
    assert.match(settled.kind === "block" ? settled.reason : "", /reported complete without a test report \(write_test_report\)/);
  });

  it("lets a blocked refinement wait for the existing question it names, instead of ending done", () => {
    const settled = decideSettlement(input({ result: result("blocked", "Waits for Q-1-004", ["Q-1-004"]), openWaitingFor: ["Q-1-004"] }));

    assert.deepEqual(settled, { kind: "wait", ids: ["Q-1-004"], reason: null });
  });

  it("keeps a budget stop for the user's Re-run, with what it asked remembered", () => {
    const settled = decideSettlement(input({ outcome: "budget-exceeded", result: result("partial", "x", ["Q-1-004"]), handoffs: [ask("AT-1-002")], openWaitingFor: ["Q-1-004"] }));

    assert.deepEqual(settled, { kind: "budget", dependsOn: ["AT-1-002", "Q-1-004"] });
  });

  it("waits for a writer's own items rather than what the run asked", () => {
    const settled = decideSettlement(input({ result: result("partial"), handoffs: [ask("Q-1-001"), ask("AT-1-002")], writers: [{ kind: "waits", ids: ["Q-1-001"], reason: "The test waits for its blocking items" }] }));

    assert.deepEqual(settled, { kind: "wait", ids: ["Q-1-001"], reason: "The test waits for its blocking items" });
  });

  it("holds the task for a writer's blockers even when write_result says complete", () => {
    const blockedTest = decideSettlement(input({ handoffs: [ask("Q-1-001")], writers: [{ kind: "waits", ids: ["Q-1-001"], reason: "The test waits for its blocking items" }] }));

    assert.deepEqual(blockedTest, { kind: "wait", ids: ["Q-1-001"], reason: "The test waits for its blocking items" });
  });

  it("waits for what an ask hand-off went to, even when write_result says complete", () => {
    const partial = decideSettlement(input({ result: result("partial"), handoffs: [ask("AT-1-002")] }));
    const complete = decideSettlement(input({ handoffs: [ask("Q-1-006"), ask("HT-1-007")] }));

    assert.deepEqual(partial, { kind: "wait", ids: ["AT-1-002"], reason: "Waiting for what it asked" });
    assert.deepEqual(complete, { kind: "wait", ids: ["Q-1-006", "HT-1-007"], reason: "Waiting for what it asked" });
  });

  it("lets design without a design wait for the questions it handed to a person", () => {
    const settled = decideSettlement(input({ result: result("blocked", "Needs the cut-off"), handoffs: [ask("Q-1-006")] }));

    assert.deepEqual(settled, { kind: "wait", ids: ["Q-1-006"], reason: "Waiting for what it asked" });
  });

  it("ends done when a hand-off carries the work on, reviews it or returns it, whatever the status", () => {
    for (const intent of ["continue", "review", "return"] as const) {
      assert.deepEqual(decideSettlement(input({ result: result("partial"), handoffs: [ask("HT-1-003"), carryOn("RT-1-005", intent)] })), { kind: "done" }, intent);
    }
  });

  it("does not let a carry-on hand-off cover another writer's missing output or blockers", () => {
    const followUp = carryOn("RT-1-005");
    const noReport = decideSettlement(input({ handoffs: [followUp], writers: [{ kind: "missing", output: "a test report (write_test_report)" }] }));
    const testBlockers = decideSettlement(input({ handoffs: [followUp], writers: [{ kind: "waits", ids: ["Q-1-006"], reason: "The test waits for its blocking items" }] }));

    assert.equal(noReport.kind, "block");
    assert.deepEqual(testBlockers, { kind: "wait", ids: ["Q-1-006"], reason: "The test waits for its blocking items" });
  });

  it("ends a complete run done when its plain create_task tasks hold nothing", () => {
    assert.deepEqual(decideSettlement(input({ handoffs: [] })), { kind: "done" });
  });

  it("blocks an unfinished run with nothing to wait for, with its one-line summary", () => {
    const settled = decideSettlement(input({ result: result("blocked", "\n# Waits for the facility list\n\nDetails") }));

    assert.deepEqual(settled, { kind: "block", reason: "The run ended blocked with nothing to wait for: Waits for the facility list. Settle what it names, then Re-run." });
  });
});
