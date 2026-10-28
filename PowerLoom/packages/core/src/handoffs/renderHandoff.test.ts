import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { HandoffView } from "../models/HandoffView";
import type { NewHandoff } from "../models/NewHandoff";
import { approvalSteps } from "./approvalSteps";
import { handoffChatSection, handoffContextBlock, handoffHumanTaskBody } from "./renderHandoff";

const REVIEW: NewHandoff = {
  from: { taskId: "PT-1-001", agent: "planning", runId: 812 },
  toKind: "human",
  intent: "review",
  gate: "approve",
  package: { body: "The plan archives expired orders in OrderArchiver.", refs: { results: ["RUN-812"], items: [], notes: ["shop/orders/expiry.md"] } },
};

function view(overrides: Partial<HandoffView> = {}): HandoffView {
  return { ...REVIEW, id: 1, toItemId: "HT-1-002", status: "open", createdAt: new Date(0), closedAt: null, targetStatus: "open", targetResolution: null, ...overrides };
}

const CONTINUE = view({ id: 2, toKind: "agent", toItemId: "XT-1-003", intent: "continue", gate: "none", package: { body: "Implement the approved plan.", refs: { results: [], items: ["HT-1-002"], notes: [] } } });
const APPROVED = view({ status: "closed", closedAt: new Date(1), targetStatus: "done", targetResolution: "### 1. Review the plan and decide\n\napprove" });

describe("handoffContextBlock", () => {
  it("gives the receiving agent its hand-off, the outcome it waited for, then its previous result, in that order", () => {
    const block = handoffContextBlock({ incoming: [CONTINUE], dependencies: [APPROVED], previous: { runId: 9, status: "partial", body: "Step 1 done." } });

    assert.match(block, /^<handoff from="PT-1-001" agent="planning" run="RUN-812" intent="continue" gate="none">\nImplement the approved plan\.\nRead: Items HT-1-002\n<\/handoff>/);
    assert.match(block, /<handoff-outcome item="HT-1-002" intent="review" gate="approve" status="done">\n### 1\. Review the plan and decide\n\napprove\n<\/handoff-outcome>/);
    assert.match(block, /<previous-result run="RUN-9" status="partial">\nStep 1 done\.\n<\/previous-result>/);
    assert.ok(block.indexOf("<handoff ") < block.indexOf("<handoff-outcome") && block.indexOf("<handoff-outcome") < block.indexOf("<previous-result"));
    assert.match(block, /Read the hand-off first[\s\S]*act on it before anything else[\s\S]*Continue from the previous result/);
  });

  it("is empty for a first run nothing was handed to", () => {
    assert.equal(handoffContextBlock({ incoming: [], dependencies: [], previous: null }), "");
  });

  it("says when a dependency's target closed without an answer", () => {
    const block = handoffContextBlock({ incoming: [], dependencies: [view({ status: "closed", targetStatus: "cancelled" })], previous: null });

    assert.match(block, /status="cancelled">\n\(no answer\)\n<\/handoff-outcome>/);
  });
});

describe("handoffHumanTaskBody", () => {
  it("puts the package before the review's fixed steps and what closes it", () => {
    const body = handoffHumanTaskBody(REVIEW, { why: "Implementation waits for it.", solves: "Approve the plan.", steps: approvalSteps("the plan") }, "## Done when\n\napprove");

    assert.match(body, /^\*\*Handed off by\*\* PT-1-001 \(planning, RUN-812\): review the sender's output; the tasks after it wait for your decision\./);
    assert.match(body, /The plan archives expired orders in OrderArchiver\.\n\nRead: Results RUN-812; Notes shop\/orders\/expiry\.md/);
    assert.match(body, /### Step 1: Review the plan and decide[\s\S]*\*\*Report back:\*\* `approve`, or `changes: <what to change>`/);
    assert.match(body, /### Step 2: Check the facts it rests on[\s\S]*`ok`, or your corrections/);
    assert.match(body, /## Done when\n\napprove$/);
  });
});

describe("handoffChatSection", () => {
  it("shows the Continue chat where the item came from and how what it waits for closed", () => {
    const section = handoffChatSection({ incoming: [CONTINUE], dependencies: [APPROVED], previous: null });

    assert.match(section ?? "", /^\*\*Handed off by\*\* PT-1-001 \(planning, RUN-812\): carry the work on from here\.\n\nImplement the approved plan\./);
    assert.match(section ?? "", /\*\*HT-1-002\*\* \(review, gate approve\): closed done\.\n\n### 1\. Review the plan and decide\n\napprove/);
  });

  it("is null for an item no hand-off touches", () => {
    assert.equal(handoffChatSection({ incoming: [], dependencies: [], previous: { runId: 1, status: "complete", body: "x" } }), null);
  });
});
