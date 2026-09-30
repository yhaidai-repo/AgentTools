import { frontmatter } from "./frontmatter";
import { escapeCell, htmlToMarkdown, isoDate, region } from "./markdown";
import type { PbiNote } from "./models/PbiNote";
import { pbiNoteName, sprintNoteName } from "./paths";

export function renderPbiNote(note: PbiNote, notesSection: string): string {
  const name = pbiNoteName(note.adoId);

  return [
    renderFrontmatter(note, name),
    `# ${name} ${note.title}`,
    region("ado", renderAdoTable(note)),
    "## Description",
    region("description", htmlToMarkdown(note.descriptionHtml)),
    "## Acceptance criteria",
    region("acceptance-criteria", htmlToMarkdown(note.acceptanceCriteriaHtml)),
    "## Items",
    region("items", "None yet."),
    notesSection,
  ].join("\n\n");
}

function renderFrontmatter(note: PbiNote, name: string): string {
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
    effort: note.effort,
    out_of_scope: note.outOfScope,
    created_by: "sync",
    created: isoDate(note.created),
    updated: isoDate(note.updated),
    tags: ["adoa", `pbi-${note.adoId}`, "pbi"],
    related: [],
  });
}

function renderAdoTable(note: PbiNote): string {
  const rows: [string, string][] = [
    ["Azure DevOps", `[${note.adoId}](${note.adoUrl})`],
    ["Type", note.type],
    ["ADO state", note.adoState],
    ["Sprint", sprintCell(note)],
    ["Area", note.areaPath ?? "–"],
    ["Assigned to", note.assignedTo ?? "–"],
    ["Priority", note.priority?.toString() ?? "–"],
    ["Effort", note.effort?.toString() ?? "–"],
    ["Tags", note.tags.join(", ") || "–"],
  ];
  const body = rows.map(([field, value]) => `| ${field} | ${escapeCell(value)} |`);

  return ["| Field | Value |", "|---|---|", ...body].join("\n");
}

// Only current/next sprints have notes; other iterations are shown as plain paths.
function sprintCell(note: PbiNote): string {
  if (!note.iterationPath) {
    return "–";
  }

  return note.isSprintKnown ? `[[${sprintNoteName(note.iterationPath)}]]` : note.iterationPath;
}
