import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ReadLog } from "../evidence/ReadLog";
import { loadPrompt } from "../prompts";
import { readableResult } from "./commitBetterResearch";
import type { BetterResearchDraft } from "./models/BetterResearchDraft";
import type { BetterResearchResult } from "./models/BetterResearchResult";
import { createResultTool } from "./resultTool";

type ResultInput = Parameters<ReturnType<typeof createResultTool>["handler"]>[0];

const EVIDENCE = [{ source: "S0", ref: "PBI 34881 description", note: "the symptom as reported" }];

function emptyDraft(): BetterResearchDraft {
  return { result: null, tasks: [], captures: [], pages: [] };
}

function resultInput(overrides: Record<string, unknown> = {}): ResultInput {
  return {
    question: "Why do expired signals stay active?",
    conclusion: "The container's TTL is off, so expired signals are never purged and never archived.",
    status: "complete",
    findings: [{ fact: "The grid shows signals past their IneffectiveDate", evidence: EVIDENCE, certainty: "verified" }],
    bug: { cause: "TTL off on patient-signals-expiration", premise_checked: "Stage, reported by QA", fix_alone_is_enough: "yes", fix_alone_reason: "Archiving already lowers the counter" },
    options: [],
    not_found: [],
    confidence: "medium",
    start_points: [],
    relevant_docs: [],
    relevant_pages: [],
    next_reason: "The cause is known; design can plan the fix.",
    ...overrides,
  } as ResultInput;
}

describe("write_research_result (Better Research)", () => {
  it("saves a result whose evidence the run read", async () => {
    const draft = emptyDraft();
    const tool = createResultTool(draft, new ReadLog("PBI 34881"));

    const saved = await tool.handler(resultInput());

    assert.equal(saved.text, "Research result saved (complete).");
    assert.equal(draft.result?.bug?.fixAloneIsEnough, "yes");
    assert.equal(draft.result?.nextReason, "The cause is known; design can plan the fix.");
  });

  it("rejects evidence the run never read and not_found without where it looked", async () => {
    const draft = emptyDraft();
    const tool = createResultTool(draft, new ReadLog("PBI 34881"));
    const invented = [{ fact: "SignalDbMigrator runs at startup", evidence: [{ source: "S3", ref: "Signals/Program.cs", note: "assumed" }], certainty: "verified" }];

    const result = await tool.handler(resultInput({ status: "not_found", findings: invented }));

    assert.equal(result.isError, true);
    assert.match(result.text, /cites S3, which this run never read/);
    assert.match(result.text, /status not_found needs not_found/);
    assert.equal(draft.result, null);
  });
});

describe("readableResult", () => {
  it("keeps the fields today's readers show and folds the bug, options and not-found into findings", () => {
    const result: BetterResearchResult = {
      question: "q",
      conclusion: "c",
      status: "complete",
      findings: [{ fact: "Archiving lowers totalActive", evidence: EVIDENCE, certainty: "inferred" }],
      bug: { cause: "TTL off", premiseChecked: "Stage", fixAloneIsEnough: "yes", fixAloneReason: "archiving exists" },
      options: [{ option: "Set defaultTtl -1", pros: "one line", cons: "", evidence: EVIDENCE }],
      notFound: [{ what: "A backfill", looked: "deployments/ notes" }],
      confidence: "high",
      startPoints: [{ location: "Signals/infra/cosmos.bicep", why: "TTL setting" }],
      relevantDocs: [],
      nextReason: "none needed",
    };

    const readable = readableResult(result);

    assert.deepEqual(readable.findings, [
      "Archiving lowers totalActive (inferred)",
      "Cause: TTL off",
      "Premise checked: Stage",
      "Fixing the cause alone is enough: yes – archiving exists",
      "Option: Set defaultTtl -1. Pros: one line. Cons: –",
      "Not found: A backfill (looked: deployments/ notes)",
    ]);
    assert.equal(readable.evidence.length, 2);
    assert.deepEqual(readable.codeRefs, result.startPoints);
  });
});

describe("better-research prompt", () => {
  it("starts with the shared framework and records both versions", async () => {
    const prompt = await loadPrompt("better-research", { team: "Signals" });

    assert.equal(prompt.version, "v3+framework.v2");
    assert.match(prompt.text, /^## How you work/);
    assert.match(prompt.text, /You are Better Research of the Signals team/);
  });
});
