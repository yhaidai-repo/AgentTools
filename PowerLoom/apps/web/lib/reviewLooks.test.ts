import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { reviewHeading, reviewIdLabel } from "./reviewLooks";

describe("review ids", () => {
  it("names a pull request by its number and a review without one by its kind", () => {
    assert.deepEqual(reviewIdLabel({ id: 512, origin: "sync", sourceRef: "refs/heads/feature/x" }), { text: "512", title: undefined });
    assert.equal(reviewIdLabel({ id: 9000001, origin: "local", sourceRef: "refs/heads/feature/x" }).text, "branch");
    assert.equal(reviewIdLabel({ id: 9000002, origin: "local-repo", sourceRef: "refs/heads/feature/x" }).text, "local");
    assert.equal(reviewIdLabel({ id: 9000003, origin: "github", sourceRef: "refs/pull/42/head" }).text, "#42");
    assert.equal(reviewHeading({ id: 512, origin: "user", sourceRef: "refs/heads/feature/x" }), "PR 512");
    assert.equal(reviewHeading({ id: 9000002, origin: "local-repo", sourceRef: "refs/heads/feature/x" }), "Local review");
    assert.equal(reviewHeading({ id: 9000003, origin: "github", sourceRef: "refs/pull/42/head" }), "GitHub PR #42");
  });
});
