import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PbiNote } from "./models/PbiNote";
import { extractNotesSection } from "./notesSection";
import { renderPreparedPbi } from "./renderPreparedPbi";

const NOTE: PbiNote = {
  adoId: 7, title: "Login", type: "Product Backlog Item", adoState: "New", adoUrl: "", pipelineStatus: "new", iterationPath: null, areaPath: null,
  assignedTo: null, priority: null, tags: [], descriptionMd: "d", acceptanceCriteriaMd: "a", parentId: null, created: new Date(0), updated: new Date(0),
};

function headings(text: string): number {
  return text.match(/^## Notes/gm)?.length ?? 0;
}

describe("the user's Notes section", () => {
  it("stays one section when the template was saved with Windows line endings", () => {
    const template = "# {{id}} {{title}}\r\n\r\n## Description\r\n\r\n{{description}}\r\n\r\n## Notes\r\n";
    let note = renderPreparedPbi(template, NOTE, extractNotesSection(null));

    note = renderPreparedPbi(template, NOTE, extractNotesSection(note));
    note = renderPreparedPbi(template, NOTE, extractNotesSection(note));

    assert.equal(headings(note), 1);
    assert.ok(!note.includes("\r"));
  });

  it("drops the empty headings an earlier render stacked above the user's text", () => {
    const broken = "# PBI\n\n## Notes\n\n## Notes\n\n## Notes\n\nMy own remark.\n";

    assert.equal(extractNotesSection(broken), "## Notes\n\nMy own remark.\n");
  });

  it("keeps a heading line with a Windows line ending as the section's start", () => {
    assert.equal(extractNotesSection("# PBI\r\n\r\n## Notes\r\nMine\r\n"), "## Notes\r\nMine\n");
  });
});
