import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ResultDraft } from "../result/models/ResultDraft";
import { decideSettlement, type SettlementInput } from "./settleTask";

function result(status: ResultDraft["status"], body = "# Summary line", waitingFor: string[] = []): ResultDraft {
  return { status, body, data: null, evidence: [], waitingFor };
}

function input(overrides: Partial<SettlementInput>): SettlementInput {
  return { outcome: "success", result: result("complete"), createdIds: [], openWaitingFor: [], writers: [], ...overrides };
}

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

  it("keeps a budget stop for the user's Re-run, with what it waits for remembered", () => {
    const settled = decideSettlement(input({ outcome: "budget-exceeded", result: result("partial", "x", ["Q-1-004"]), createdIds: ["AT-1-002"], openWaitingFor: ["Q-1-004"] }));

    assert.deepEqual(settled, { kind: "budget", dependsOn: ["AT-1-002", "Q-1-004"] });
  });

  it("waits for a writer's own items rather than every task the run created", () => {
    const settled = decideSettlement(input({ result: result("partial"), createdIds: ["Q-1-001", "AT-1-002"], writers: [{ kind: "waits", ids: ["Q-1-001"], reason: "The test waits for its blocking items" }] }));

    assert.deepEqual(settled, { kind: "wait", ids: ["Q-1-001"], reason: "The test waits for its blocking items" });
  });

  it("holds the task for a writer's blockers even when write_result says complete", () => {
    const designGaps = decideSettlement(input({ writers: [{ kind: "waits", ids: ["Q-1-006"], reason: "Design needs input first" }] }));
    const blockedTest = decideSettlement(input({ createdIds: ["Q-1-001"], writers: [{ kind: "waits", ids: ["Q-1-001"], reason: "The test waits for its blocking items" }] }));

    assert.deepEqual(designGaps, { kind: "wait", ids: ["Q-1-006"], reason: "Design needs input first" });
    assert.deepEqual(blockedTest, { kind: "wait", ids: ["Q-1-001"], reason: "The test waits for its blocking items" });
  });

  it("waits for every created task when no writer says otherwise", () => {
    assert.deepEqual(decideSettlement(input({ result: result("partial"), createdIds: ["AT-1-002"] })), { kind: "wait", ids: ["AT-1-002"], reason: null });
  });

  it("ends done when a follow-up carries the work on, whatever the status", () => {
    assert.deepEqual(decideSettlement(input({ result: result("partial"), createdIds: ["HT-1-003"], writers: [{ kind: "handedOn", id: "RF-1-005" }] })), { kind: "done" });
  });

  it("blocks an unfinished run with nothing to wait for, with its one-line summary", () => {
    const settled = decideSettlement(input({ result: result("blocked", "\n# Waits for the facility list\n\nDetails") }));

    assert.deepEqual(settled, { kind: "block", reason: "The run ended blocked with nothing to wait for: Waits for the facility list. Settle what it names, then Re-run." });
  });
});
