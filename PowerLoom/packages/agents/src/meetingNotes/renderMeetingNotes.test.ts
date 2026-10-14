import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { MeetingNotes } from "./models/MeetingNotes";
import type { MeetingTaskData } from "./models/MeetingTaskData";
import { meetingNotesPath, renderMeetingNotes } from "./renderMeetingNotes";

const DATA: MeetingTaskData = {
  sourceRef: "2026-10-14_1926-backlog-refinement",
  startedAt: "2026-10-14T19:26:16+07:00",
  endedAt: "2026-10-14T20:34:00+07:00",
  durationSec: 4064,
  speakers: ["Me", "Vlad", "Speaker 2"],
  transcriptNote: "meetings/2026-10-14_1926-backlog-refinement-transcript.md",
};

const NOTES: MeetingNotes = {
  title: "Backlog Refinement: Angular errors",
  summary: "The team discussed client errors in the Angular portal.",
  participants: [{ label: "Vlad", who: null }, { label: "Speaker 2", who: "Andrew" }],
  decisions: ["Add a client exception handler that reports to one endpoint."],
  actionItems: [{ owner: "Me", what: "Create the card for the handler", due: "Friday", saidAt: "00:01:20" }],
  pbis: [{ id: 34252, title: "Angular error handler", said: "Needs a card.", saidAt: "00:01:15" }, { id: null, title: "Smoke tests", said: "Miss console errors.", saidAt: "00:01:00" }],
  openQuestions: [],
  corrections: ["Інгуларі → Angular"],
};

describe("renderMeetingNotes", () => {
  it("writes frontmatter, the transcript link and only the sections with content", () => {
    const note = renderMeetingNotes(NOTES, DATA, "MT-003", (id) => `https://dev.azure.com/org/AA/_workitems/edit/${id}`);

    assert.match(note, /^---\ntitle: "Backlog Refinement: Angular errors"\ntype: meeting-notes\ndate: 2026-10-14\nparticipants: \["Vlad", "Andrew"\]/);
    assert.ok(note.includes("transcript: [[meetings/2026-10-14_1926-backlog-refinement-transcript]]"));
    assert.ok(note.includes("- Speaker 2: Andrew"));
    assert.ok(note.includes("- [ ] Me: Create the card for the handler (due Friday) [00:01:20]"));
    assert.ok(note.includes("- [PBI-34252](https://dev.azure.com/org/AA/_workitems/edit/34252) Angular error handler: Needs a card. [00:01:15]"));
    assert.ok(note.includes("- Smoke tests: Miss console errors. [00:01:00]"));
    assert.ok(!note.includes("## Open questions"));
  });

  it("names the note by date and title, Cyrillic kept", () => {
    assert.equal(meetingNotesPath(DATA, "Ретро: спринт 26.3"), "meetings/2026-10-14-ретро-спринт-26-3.md");
  });
});
