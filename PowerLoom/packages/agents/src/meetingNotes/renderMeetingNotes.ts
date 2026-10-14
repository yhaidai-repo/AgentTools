import type { MeetingNotes } from "./models/MeetingNotes";
import type { MeetingTaskData } from "./models/MeetingTaskData";

// Where the notes go: meetings/<date>-<slug>.md next to the transcript note.
export function meetingNotesPath(data: MeetingTaskData, title: string): string {
  return `meetings/${data.startedAt.slice(0, 10)}-${slug(title)}.md`;
}

// The notes as a vault note: frontmatter, a link to the transcript, then the sections that have content. `pbiUrl` turns
// a work item id into its Azure DevOps link (null when the vault has no ADO settings).
export function renderMeetingNotes(notes: MeetingNotes, data: MeetingTaskData, taskId: string, pbiUrl: ((id: number) => string) | null): string {
  const transcript = data.transcriptNote.replace(/\.md$/, "");

  return [
    frontmatter(notes, data, taskId),
    `# ${notes.title}`,
    `${data.startedAt.slice(0, 16).replace("T", " ")} · ${Math.round(data.durationSec / 60)} min · transcript: [[${transcript}]]`,
    section("Summary", [notes.summary]),
    section("Participants", notes.participants.map((p) => `- ${p.label}${p.who && p.who !== p.label ? `: ${p.who}` : ""}`)),
    section("Decisions", notes.decisions.map((d) => `- ${d}`)),
    section("Action items", notes.actionItems.map((a) => `- [ ] ${a.owner}: ${a.what}${a.due ? ` (due ${a.due})` : ""} [${a.saidAt}]`)),
    section("Work items", notes.pbis.map((p) => `- ${pbiLabel(p.id, p.title, pbiUrl)}: ${p.said} [${p.saidAt}]`)),
    section("Open questions", notes.openQuestions.map((q) => `- ${q}`)),
    section("Transcript corrections", notes.corrections.map((c) => `- ${c}`)),
  ].filter((part) => part.length > 0).join("\n\n") + "\n";
}

function frontmatter(notes: MeetingNotes, data: MeetingTaskData, taskId: string): string {
  return [
    "---",
    `title: ${quoted(notes.title)}`,
    "type: meeting-notes",
    `date: ${data.startedAt.slice(0, 10)}`,
    `participants: [${notes.participants.map((p) => quoted(p.who ?? p.label)).join(", ")}]`,
    `transcript: ${quoted(`[[${data.transcriptNote.replace(/\.md$/, "")}]]`)}`,
    `source: ${taskId}`,
    "---",
  ].join("\n");
}

function section(heading: string, lines: string[]): string {
  const content = lines.filter((line) => line.trim().length > 0);

  return content.length === 0 ? "" : `## ${heading}\n${content.join("\n")}`;
}

function pbiLabel(id: number | null, title: string, pbiUrl: ((id: number) => string) | null): string {
  if (id === null) {
    return title;
  }

  return pbiUrl ? `[PBI-${id}](${pbiUrl(id)}) ${title}` : `PBI-${id} ${title}`;
}

function quoted(text: string): string {
  return `"${text.replaceAll('"', "'")}"`;
}

// Letters of any script stay (Cyrillic titles), everything else becomes a dash.
function slug(title: string): string {
  const cleaned = title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "");

  return (cleaned || "meeting").slice(0, 60);
}
