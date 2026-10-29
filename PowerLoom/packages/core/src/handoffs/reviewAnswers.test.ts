import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { confirmsFacts, isApproval, reviewAnswers } from "./reviewAnswers";

const RESOLUTION = "### 1. Review the plan and decide\n\nchanges: archive after 30 days\n\n### 2. Check the facts and assumptions it rests on\n\nThe limit is 30, not 7.\n\n### Note\n\nthanks";

describe("reviewAnswers", () => {
  it("reads the decision and the facts answer of a review", () => {
    assert.deepEqual(reviewAnswers(RESOLUTION), { decision: "changes: archive after 30 days", facts: "The limit is 30, not 7." });
  });

  it("gives empty answers for a review closed without them", () => {
    assert.deepEqual(reviewAnswers(null), { decision: "", facts: "" });
    assert.deepEqual(reviewAnswers("### 2. Check\n\nok"), { decision: "", facts: "ok" });
  });

  it("counts approve in backticks or with a full stop, never with conditions", () => {
    assert.equal(isApproval("`approve`"), true);
    assert.equal(isApproval("Approved."), true);
    assert.equal(isApproval("approve, but rename the job"), false);
  });

  it("takes ok or nothing as confirmed facts and anything else as corrections", () => {
    assert.equal(confirmsFacts("`ok`"), true);
    assert.equal(confirmsFacts(""), true);
    assert.equal(confirmsFacts("The limit is 30"), false);
  });
});
