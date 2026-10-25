import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ResultDraft } from "../result/models/ResultDraft";
import { unfinishedReason } from "./runGenericTask";

function result(status: ResultDraft["status"], body: string): ResultDraft {
  return { status, body, data: null, evidence: [], waitingFor: [] };
}

describe("unfinishedReason", () => {
  it("lets a complete result end done", () => {
    assert.equal(unfinishedReason(result("complete", "# Done")), null);
    assert.equal(unfinishedReason(null), null);
  });

  it("blocks a partial or blocked result with its one-line summary", () => {
    assert.equal(
      unfinishedReason(result("blocked", "\n# Waits for the facility list\n\nDetails")),
      "The run ended blocked with nothing to wait for: Waits for the facility list. Settle what it names, then Re-run.",
    );
    assert.match(unfinishedReason(result("partial", "3 of 5 cases ran")) ?? "", /^The run ended partial with nothing to wait for: 3 of 5 cases ran\./);
  });
});
