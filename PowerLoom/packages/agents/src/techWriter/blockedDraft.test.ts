import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PowerLoomDb } from "@powerloom/db";
import { askUserAboutBlockedDraft, blockedDraftTask } from "./blockedDraft";

const unusedDb = {} as PowerLoomDb;

describe("blocked draft task", () => {
  it("asks the user to re-run, merge by hand or drop the draft, without a query", () => {
    const data = blockedDraftTask("WT-025", "pos-transaction-provider-selection", "commit: notes still link to the draft");

    assert.match(data.why, /couldn't merge vault draft pos-transaction-provider-selection; WT-025 is blocked/);
    assert.equal(data.steps.length, 1);
    assert.equal(data.steps[0].source, "other");
    assert.equal(data.steps[0].query, null);
  });

  it("does nothing for a task that isn't a draft merge", async () => {
    const research = { kind: "research", data: { goal: "g" } } as never;
    const actualize = { kind: "docs", data: { mode: "actualize", path: "pos/note.md" } } as never;

    assert.equal(await askUserAboutBlockedDraft(unusedDb, research, "r"), null);
    assert.equal(await askUserAboutBlockedDraft(unusedDb, actualize, "r"), null);
  });
});
