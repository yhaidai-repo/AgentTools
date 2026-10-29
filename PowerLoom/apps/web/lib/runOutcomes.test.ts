import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { outcomeDot, runEndPanel } from "./runOutcomes";

describe("a run outcome's dot", () => {
  it("shows a run the user stopped as a still grey dot, a budget stop amber and a failure rose", () => {
    assert.equal(outcomeDot("aborted"), "off");
    assert.equal(outcomeDot("budget-exceeded"), "warn");
    assert.equal(outcomeDot("failed"), "error");
  });

  it("shows running and finished runs as before", () => {
    assert.equal(outcomeDot("running"), "running");
    assert.equal(outcomeDot("success"), "ok");
    assert.equal(outcomeDot("no-op"), "ok");
    assert.equal(outcomeDot(null), "ok");
  });
});

describe("the run page's ending panel", () => {
  it("says a run the user stopped was stopped, in no tone", () => {
    assert.deepEqual(runEndPanel("aborted"), { title: "Stopped", tone: null });
  });

  it("shows a failed run's failure in the error tone", () => {
    assert.deepEqual(runEndPanel("failed"), { title: "Failure", tone: "error" });
    assert.deepEqual(runEndPanel("timeout"), { title: "Failure", tone: "error" });
  });

  it("shows no panel for a run that succeeded, runs or hit its budget", () => {
    assert.equal(runEndPanel("success"), null);
    assert.equal(runEndPanel("running"), null);
    assert.equal(runEndPanel("budget-exceeded"), null);
  });
});
