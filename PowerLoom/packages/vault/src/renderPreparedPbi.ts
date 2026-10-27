import { frontmatter } from "./frontmatter";
import { isoDate } from "./markdown";
import { replaceRegions } from "./regions";
import type { PbiNote } from "./models/PbiNote";
import { pbiNoteName } from "./paths";
import { USER_NOTES_MARKER } from "./notesSection";

const EMPTY = "–";
const EMPTY_TEXT = "_Empty in Azure DevOps._";
const NOTES_HEADING = /^## Notes[ \t]*\r?$/m;

// Frontmatter is always written by the app so metadata stays uniform; the body comes from the user's template.
// `regions` fills generated regions (e.g. refinement, items) with pipeline content.
export function renderPreparedPbi(template: string, note: PbiNote, notesSection: string, regions: Record<string, string> = {}): string {
  // A template edited on Windows has CRLF line endings; the note is written with LF throughout.
  const body = replaceRegions(fillTemplate(withoutNotes(template.replaceAll("\r\n", "\n")), placeholderValues(note)), regions);

  const generated = `${renderFrontmatter(note)}\n\n${body.trimEnd()}\n\n`.replaceAll(USER_NOTES_MARKER, "");
  return `${generated}${USER_NOTES_MARKER}\n${notesSection}`;
}

// Unknown placeholders stay visible so template typos are easy to spot.
export function fillTemplate(template: string, values: Record<string, string>): string {
  return template.replaceAll(/\{\{\s*([\w]+)\s*\}\}/g, (placeholder, name: string) => values[name] ?? placeholder);
}

function placeholderValues(note: PbiNote): Record<string, string> {
  return {
    id: pbiNoteName(note.adoId),
    ado_id: String(note.adoId),
    title: note.title,
    ado_url: note.adoUrl,
    ado_type: note.type,
    ado_state: note.adoState,
    status: note.pipelineStatus,
    iteration: note.iterationPath ?? EMPTY,
    area: note.areaPath ?? EMPTY,
    assigned_to: note.assignedTo ?? EMPTY,
    priority: note.priority?.toString() ?? EMPTY,
    tags: note.tags.join(", ") || EMPTY,
    description: note.descriptionMd || EMPTY_TEXT,
    acceptance_criteria: note.acceptanceCriteriaMd || EMPTY_TEXT,
    created: isoDate(note.created),
    updated: isoDate(note.updated),
  };
}

function renderFrontmatter(note: PbiNote): string {
  const name = pbiNoteName(note.adoId);
  const parent = note.parentId === null ? null : `[[${pbiNoteName(note.parentId)}]]`;

  return frontmatter({
    id: name,
    type: "pbi",
    title: note.title,
    status: note.pipelineStatus,
    ado_id: note.adoId,
    ado_url: note.adoUrl,
    ado_type: note.type,
    ado_state: note.adoState,
    iteration: note.iterationPath,
    priority: note.priority,
    assigned_to: note.assignedTo,
    created_by: "prepare",
    created: isoDate(note.created),
    updated: isoDate(note.updated),
    parent,
    tags: ["powerloom", `pbi-${note.adoId}`, "pbi"],
    related: parent ? [parent] : [],
  });
}

// The user's `## Notes` section replaces the template's, so it survives every re-render.
function withoutNotes(body: string): string {
  const marker = body.indexOf(USER_NOTES_MARKER);
  if (marker >= 0) return body.slice(0, marker);
  const start = body.search(NOTES_HEADING);

  return start < 0 ? body : body.slice(0, start);
}
