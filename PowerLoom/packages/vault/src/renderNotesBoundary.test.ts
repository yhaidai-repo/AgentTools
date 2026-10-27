import assert from "node:assert/strict";
import { it } from "node:test";
import { extractNotesSection, USER_NOTES_MARKER } from "./notesSection";
import { renderDesignNote } from "./renderDesignNote";
import { renderItemNote } from "./renderItemNote";
import { renderRefinementNote } from "./renderRefinementNote";

const date = new Date("2026-10-27");
const renderers = {
  item: (body: string, notes: string) => renderItemNote({ id: "RT-1-001", kind: "research", adoId: 1, parentId: null, title: "Synthetic", status: "open", assignee: "agent:test", body, data: {}, resolution: null, attachments: [], runId: 1, created: date, updated: date }, notes),
  refinement: (summary: string, notes: string) => renderRefinementNote({ adoId: 1, version: 1, runId: 1, created: date, summary, scopeIn: [], scopeOut: [], acGaps: [], dependencies: [], repos: [], assumptions: [], relevantDocs: [], docsRead: [] }, notes),
  design: (approach: string, notes: string) => renderDesignNote({ adoId: 1, version: 1, runId: 1, created: date, approach, alternatives: [], plan: [], risks: [], tests: [], assumptions: [], estHumanH: null, estAgentH: null, complexity: null, confidence: null, estimateBasis: "" }, notes),
};

for (const [name, render] of Object.entries(renderers)) {
  for (const ending of ["\n", "\r\n"]) {
    it(`${name} preserves human notes and replaces generated Notes headings with ${JSON.stringify(ending)}`, () => {
      const first = render(`## Notes\nOLD GENERATED TEXT\n${USER_NOTES_MARKER}`, "## Notes\nHUMAN NOTE\n").replaceAll("\n", ending);
      const second = render("## Notes\nNEW GENERATED TEXT", extractNotesSection(first));
      const third = render("## Notes\nLATEST GENERATED TEXT", extractNotesSection(second));
      assert.doesNotMatch(third, /OLD GENERATED TEXT|NEW GENERATED TEXT/);
      assert.match(third, /LATEST GENERATED TEXT/);
      assert.match(extractNotesSection(third), /HUMAN NOTE/);
      assert.doesNotMatch(extractNotesSection(third), /GENERATED TEXT/);
      assert.equal(third.split(USER_NOTES_MARKER).length - 1, 1);
    });
  }
}
