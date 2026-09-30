import { frontmatter } from "./frontmatter";
import { isoDate } from "./markdown";
import type { PbiNote } from "./models/PbiNote";
import { pbiNoteName } from "./paths";

const EMPTY = "–";
const EMPTY_TEXT = "_Empty in Azure DevOps._";
const NOTES_HEADING = /^## Notes[ \t]*$/m;

// Frontmatter is always written by the app so metadata stays uniform; the body comes from the user's template.
export function renderPreparedPbi(template: string, note: PbiNote, notesSection: string): string {
  const body = fillTemplate(template, placeholderValues(note));

  return `${renderFrontmatter(note)}\n\n${withoutNotes(body).trimEnd()}\n\n${notesSection}`;
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
    tags: ["adoa", `pbi-${note.adoId}`, "pbi"],
    related: [],
  });
}

// The user's `## Notes` section replaces the template's, so it survives every re-render.
function withoutNotes(body: string): string {
  const start = body.search(NOTES_HEADING);

  return start < 0 ? body : body.slice(0, start);
}
