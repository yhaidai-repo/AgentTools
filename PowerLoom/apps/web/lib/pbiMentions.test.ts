import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pbiMentionHref, splitPbiMentions } from "./pbiMentions";

describe("splitPbiMentions", () => {
  it("links a PBI mention to its page", () => {
    assert.deepEqual(splitPbiMentions("Confirm repos for PBI-30270."), ["Confirm repos for ", { text: "PBI-30270", href: "/pbis/30270" }, "."]);
  });

  it("links a versioned reference as a whole to the latest result of that kind", () => {
    assert.deepEqual(splitPbiMentions("Plan PBI-22884:plan has two plans"), ["Plan ", { text: "PBI-22884:plan", href: "/results/plan/PBI-22884" }, " has two plans"]);
  });

  it("links only the PBI when what follows the colon is not a result kind", () => {
    assert.deepEqual(splitPbiMentions("PBI-1:notes"), [{ text: "PBI-1", href: "/pbis/1" }, ":notes"]);
  });

  it("leaves text without mentions whole, and a word that only contains one", () => {
    assert.deepEqual(splitPbiMentions("nothing here"), ["nothing here"]);
    assert.deepEqual(splitPbiMentions("SUBPBI-1"), ["SUBPBI-1"]);
  });
});

describe("pbiMentionHref", () => {
  it("is the PBI page without a kind, the latest result of the kind with one", () => {
    assert.equal(pbiMentionHref("5", undefined), "/pbis/5");
    assert.equal(pbiMentionHref("5", "estimate"), "/results/estimate/PBI-5");
  });
});
