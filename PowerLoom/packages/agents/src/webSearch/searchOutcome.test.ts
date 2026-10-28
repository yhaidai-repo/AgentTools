import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { searchOutcome } from "./searchOutcome";

const HIT = { title: "HETS 270/271 Companion Guide", url: "https://www.cms.gov/files/hets.pdf", snippet: "AAA03 reject reasons" };
const GOOGLE_BLOCKED = [{ engine: "google", reason: "CAPTCHA" }];

describe("searchOutcome", () => {
  it("lists the hits, cut to the count asked for", () => {
    const result = searchOutcome("hets", { hits: [HIT, { ...HIT, url: "https://b.example" }], unresponsiveEngines: [] }, 1);

    assert.deepEqual(result, { text: "1. HETS 270/271 Companion Guide\n   https://www.cms.gov/files/hets.pdf\n   AAA03 reject reasons", rows: 1 });
  });

  it("keeps hits when some engines didn't respond, and names them for the agent and the log", () => {
    const result = searchOutcome("hets", { hits: [HIT], unresponsiveEngines: GOOGLE_BLOCKED }, 10);

    assert.equal(result.isError, undefined);
    assert.equal(result.note, "Engines that did not respond: google (CAPTCHA).");
    assert.match(result.text, /\n\nEngines that did not respond: google \(CAPTCHA\)\.$/);
  });

  it("fails a search with no hits when engines didn't respond", () => {
    const result = searchOutcome("hets", { hits: [], unresponsiveEngines: GOOGLE_BLOCKED }, 10);

    assert.deepEqual(result, { text: "Web search found nothing for \"hets\". Engines that did not respond: google (CAPTCHA). Use your own web search.", isError: true });
  });

  it("answers no results when every engine answered", () => {
    assert.deepEqual(searchOutcome("hets", { hits: [], unresponsiveEngines: [] }, 10), { text: "No results for \"hets\".", rows: 0 });
  });

  it("cuts a long snippet", () => {
    const result = searchOutcome("hets", { hits: [{ ...HIT, snippet: "a".repeat(400) }], unresponsiveEngines: [] }, 10);

    assert.ok(result.text.endsWith(`${"a".repeat(300)}…`));
  });
});
