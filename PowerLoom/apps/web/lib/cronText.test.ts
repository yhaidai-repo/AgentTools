import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cronText } from "./cronText";

describe("cronText", () => {
  it("names the days of a weekly schedule", () => {
    assert.equal(cronText("0 6 * * 1,4"), "Mon, Thu at 06:00");
    assert.equal(cronText("15 6 * * 1"), "Mon at 06:15");
  });

  it("keeps the other forms", () => {
    assert.equal(cronText("0 */6 * * *"), "every 6 h");
    assert.equal(cronText("30 7 * * 1-5"), "weekdays at 07:30");
    assert.equal(cronText("0 6 1 * *"), "0 6 1 * *");
  });
});
