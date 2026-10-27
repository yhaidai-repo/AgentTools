import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PbiNote } from "./models/PbiNote";
import { extractNotesSection, splitNotesSection, USER_NOTES_MARKER } from "./notesSection";
import { renderPreparedPbi } from "./renderPreparedPbi";

const NOTE: PbiNote = {
  adoId: 7, title: "Login", type: "Product Backlog Item", adoState: "New", adoUrl: "", pipelineStatus: "new", iterationPath: null, areaPath: null,
  assignedTo: null, priority: null, tags: [], descriptionMd: "d", acceptanceCriteriaMd: "a", parentId: null, created: new Date(0), updated: new Date(0),
};

function headings(text: string): number {
  return text.match(/^## Notes/gm)?.length ?? 0;
}

describe("the user's Notes section", () => {
  it("honors an explicit template boundary before expanding content", () => {
    const template = `# {{title}}\n${USER_NOTES_MARKER}\nSTALE\n## Notes\nold text`;
    const rendered = renderPreparedPbi(template, NOTE, "## Notes\nHuman text\n");
    assert.doesNotMatch(rendered, /STALE|old text/);
    assert.equal(splitNotesSection(rendered).userNotes, "Human text");
  });
  it("S3-03 keeps headings inside description and AC generated across repeated renders", () => {
    const template = "{{description}}\n\n{{acceptance_criteria}}\n\n## Notes\n";
    const note = { ...NOTE, descriptionMd: "Description\n## Notes\nDescription tail", acceptanceCriteriaMd: "AC\n## Notes\nAC tail" };
    let rendered = renderPreparedPbi(template, note, "## Notes\n\nHuman text\n## Notes\nHuman tail\n");
    for (let i = 0; i < 3; i++) {
      assert.match(splitNotesSection(rendered).generated, /Description tail/);
      assert.match(splitNotesSection(rendered).generated, /AC tail/);
      assert.equal(splitNotesSection(rendered).userNotes, "Human text\n## Notes\nHuman tail");
      rendered = renderPreparedPbi(template, note, extractNotesSection(rendered));
    }
  });

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
