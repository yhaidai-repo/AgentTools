import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { previousResultBlock } from "./previousResult";

describe("previousResultBlock", () => {
  const previous = { runId: 5, status: "partial", body: "Checks 1-20 passed." };

  it("hands a rerun the task's latest result to continue from", () => {
    const block = previousResultBlock(previous, false);

    assert.match(block, /<previous-result run="RUN-5" status="partial">/);
    assert.match(block, /Continue from it/);
  });

  it("leaves it out when the user chose Start over", () => {
    assert.equal(previousResultBlock(previous, true), "");
  });

  it("is empty for a task's first run", () => {
    assert.equal(previousResultBlock(null, false), "");
  });
});
