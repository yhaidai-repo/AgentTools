import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseTestSteps } from "./testSteps";

const XML = `<steps id="0" last="5">
<step id="2" type="ActionStep"><parameterizedString isformatted="true">&lt;DIV&gt;&lt;P&gt;Open Billing &amp;gt; Billable Features&lt;/P&gt;&lt;/DIV&gt;</parameterizedString><parameterizedString isformatted="true">&lt;P&gt;The report opens&lt;/P&gt;</parameterizedString><description/></step>
<compref id="3" ref="40123"><step id="4" type="ValidateStep"><parameterizedString isformatted="true">Download May 2026</parameterizedString><parameterizedString isformatted="true"/><description/></step></compref>
</steps>`;

describe("parseTestSteps", () => {
  it("reads own steps and shared steps in order, texts as HTML", () => {
    assert.deepEqual(parseTestSteps(XML), [
      { kind: "step", action: "<DIV><P>Open Billing &gt; Billable Features</P></DIV>", expected: "<P>The report opens</P>" },
      { kind: "shared", sharedStepsId: 40123 },
      { kind: "step", action: "Download May 2026", expected: "" },
    ]);
  });

  it("has no steps for an empty or missing field", () => {
    assert.deepEqual(parseTestSteps(null), []);
    assert.deepEqual(parseTestSteps("<steps id=\"0\" last=\"1\"/>"), []);
  });
});
