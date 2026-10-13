import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { BetterResearchResult } from "./models/BetterResearchResult";
import { renderResult } from "./renderResult";

describe("renderResult", () => {
  it("writes a goal task's resolution with the answer first, findings, evidence, start points and next", () => {
    const result: BetterResearchResult = {
      question: "Which Cosmos containers have TTL off?",
      conclusion: "Only patient-signals-expiration.",
      status: "complete",
      findings: [{ fact: "defaultTtl is null in the bicep", evidence: [{ source: "S3", ref: "Signals/infra/cosmos.bicep:41", note: "no defaultTtl" }], certainty: "verified" }],
      bug: null,
      options: [],
      notFound: [],
      confidence: "high",
      startPoints: [{ location: "Signals/infra/cosmos.bicep", why: "container settings" }],
      relevantDocs: [],
      nextReason: "No next step: the answer is complete.",
    };

    const markdown = renderResult(result);

    assert.match(markdown, /^\*\*Question:\*\* Which Cosmos containers have TTL off\?\n\*\*Answer\*\* \(complete, confidence high\): Only patient-signals-expiration\./);
    assert.match(markdown, /## Findings\n- defaultTtl is null in the bicep\n/);
    assert.match(markdown, /## Evidence\n- `Signals\/infra\/cosmos\.bicep:41`: no defaultTtl/);
    assert.match(markdown, /## Next\nNo next step: the answer is complete\.$/);
  });
});
