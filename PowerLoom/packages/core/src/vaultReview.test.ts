import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { vaultReviewOptions } from "./vaultReview";

describe("vaultReviewOptions", () => {
  it("reviews a 15-day period unless the agent's Config sets one", () => {
    assert.equal(vaultReviewOptions({}).staleDays, 15);
    assert.equal(vaultReviewOptions({ staleDays: 45 }).staleDays, 45);
  });
});
