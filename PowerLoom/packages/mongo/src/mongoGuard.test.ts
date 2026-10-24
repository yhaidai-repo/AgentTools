import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { filterProblem, pipelineProblem } from "./mongoGuard";

describe("pipelineProblem", () => {
  it("lets a read pipeline run and refuses writing stages and server-side code, wherever they hide", () => {
    assert.equal(pipelineProblem([{ $match: { status: "open" } }, { $group: { _id: "$tenantId", n: { $sum: 1 } } }]), null);
    assert.match(pipelineProblem([{ $match: {} }, { $out: "copy" }])!, /\$out/);
    assert.match(pipelineProblem([{ $merge: { into: "copy" } }])!, /\$merge/);
    assert.match(pipelineProblem([{ $addFields: { x: { $function: { body: "…", args: [], lang: "js" } } } }])!, /\$function/);
    assert.match(pipelineProblem([{ $match: { $expr: { $accumulator: {} } } }, { $out: "x" }])!, /\$accumulator, \$out/);
    assert.match(pipelineProblem([])!, /empty/);
  });
});

describe("filterProblem", () => {
  it("lets ordinary filters through and refuses $where", () => {
    assert.equal(filterProblem({ patientId: "42", $or: [{ status: "open" }, { updatedAt: { $gt: "2026-01-01" } }] }), null);
    assert.equal(filterProblem(undefined), null);
    assert.match(filterProblem({ $where: "this.a > 1" })!, /\$where/);
  });
});
