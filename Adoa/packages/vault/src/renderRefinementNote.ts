import { frontmatter } from "./frontmatter";
import { isoDate } from "./markdown";
import type { RefinementNote } from "./models/RefinementNote";
import { pbiNoteName, refinementNoteName } from "./paths";

export function renderRefinementNote(note: RefinementNote, notesSection: string): string {
  return [
    frontmatter({
      id: refinementNoteName(note.adoId),
      type: "refinement",
      title: `Refinement v${note.version}`,
      status: "final",
      pbi: `[[${pbiNoteName(note.adoId)}]]`,
      version: note.version,
      run: note.runId === null ? null : `RUN-${note.runId}`,
      created_by: "agent:refinement",
      created: isoDate(note.created),
      updated: isoDate(note.created),
      tags: ["adoa", `pbi-${note.adoId}`, "refinement"],
      related: [`[[${pbiNoteName(note.adoId)}]]`],
    }),
    `# ${refinementNoteName(note.adoId)} Refinement v${note.version}`,
    `PBI: [[${pbiNoteName(note.adoId)}]]`,
    "## Summary",
    note.summary,
    "## Scope in",
    bullets(note.scopeIn),
    "## Scope out",
    bullets(note.scopeOut),
    "## Acceptance-criteria gaps",
    bullets(note.acGaps.map((item) => `${item.gap} → _suggested:_ ${item.suggestion}`)),
    "## Dependencies",
    bullets(note.dependencies),
    "## Repos (assumption, to confirm)",
    bullets(note.repos.map((item) => `\`${item.name}\`: ${item.reason}`)),
    "## Assumptions",
    bullets(note.assumptions),
    "## Relevant docs (for research and design)",
    bullets(note.relevantDocs.map((doc) => `\`${doc.path}\`: ${doc.why}`)),
    "## Docs read",
    bullets(note.docsRead.map((path) => `\`${path}\``)),
    notesSection,
  ].join("\n\n");
}

function bullets(items: string[]): string {
  return items.length > 0 ? items.map((item) => `- ${item}`).join("\n") : "None.";
}
