import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { kqlProblem, timespanDuration } from "./kqlGuard";

describe("kqlProblem", () => {
  it("lets a query run and refuses management commands, a leading set and an empty text", () => {
    assert.equal(kqlProblem("requests | where resultCode == 500 | take 10"), null);
    assert.equal(kqlProblem("  AppRequests\n| summarize count() by bin(TimeGenerated, 1h)"), null);
    assert.match(kqlProblem(".show tables")!, /management commands/);
    assert.match(kqlProblem("set truncationmaxrecords=100000; requests")!, /leading `set`/);
    assert.equal(kqlProblem("  "), "The query is empty.");
  });
});

describe("timespanDuration", () => {
  it("turns minutes, hours and days into ISO durations, 24h by default", () => {
    assert.deepEqual(timespanDuration(undefined), { duration: "PT24H" });
    assert.deepEqual(timespanDuration("30m"), { duration: "PT30M" });
    assert.deepEqual(timespanDuration("7d"), { duration: "P7D" });
    assert.deepEqual(timespanDuration(" 12H "), { duration: "PT12H" });
  });

  it("refuses more than 30 days and anything else", () => {
    assert.match((timespanDuration("31d") as { problem: string }).problem, /at most 30 days/);
    assert.match((timespanDuration("yesterday") as { problem: string }).problem, /number and a unit/);
    assert.match((timespanDuration("0h") as { problem: string }).problem, /at most 30 days/);
  });
});
