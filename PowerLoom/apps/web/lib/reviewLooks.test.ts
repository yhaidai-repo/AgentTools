import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { reviewHeading, reviewIdLabel } from "./reviewLooks";

describe("review ids", () => {
  it("names a pull request by its number and a review without one by its kind", () => {
    assert.deepEqual(reviewIdLabel({ id: 512, origin: "sync" }), { text: "512", title: undefined });
    assert.equal(reviewIdLabel({ id: 9000001, origin: "local" }).text, "branch");
    assert.equal(reviewIdLabel({ id: 9000002, origin: "local-repo" }).text, "local");
    assert.equal(reviewHeading({ id: 512, origin: "user" }), "PR 512");
    assert.equal(reviewHeading({ id: 9000002, origin: "local-repo" }), "Local review");
  });
});
