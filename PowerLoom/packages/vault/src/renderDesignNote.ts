import { frontmatter } from "./frontmatter";
import { escapeCell, isoDate } from "./markdown";
import type { DesignNote } from "./models/DesignNote";
import { designNoteName, pbiNoteName } from "./paths";

export function renderDesignNote(note: DesignNote, notesSection: string): string {
  return [
    frontmatter({
      id: designNoteName(note.adoId),
      type: "design",
      title: `Design v${note.version}`,
      status: "final",
      pbi: `[[${pbiNoteName(note.adoId)}]]`,
      version: note.version,
      run: note.runId === null ? null : `RUN-${note.runId}`,
      created_by: "agent:design",
      created: isoDate(note.created),
      updated: isoDate(note.created),
      tags: ["powerloom", `pbi-${note.adoId}`, "design"],
      related: [`[[${pbiNoteName(note.adoId)}]]`],
    }),
    `# ${designNoteName(note.adoId)} Design v${note.version}`,
    `PBI: [[${pbiNoteName(note.adoId)}]]`,
    "## Approach",
    note.approach,
    "## Estimate",
    estimateTable(note),
    "## Alternatives",
    bullets(note.alternatives.map((item) => `**${item.option}**: pros ${item.pros.join("; ") || "none"}; cons ${item.cons.join("; ") || "none"}. _Not chosen:_ ${item.whyNot}`)),
    "## Plan",
    planTable(note),
    "## Risks",
    bullets(note.risks.map((item) => `${item.risk} (${item.impact}) → _mitigation:_ ${item.mitigation}`)),
    "## Tests",
    bullets(note.tests.map((item) => `${item.kind}: ${item.case}`)),
    "## Assumptions",
    bullets(note.assumptions),
    notesSection,
  ].join("\n\n");
}

function estimateTable(note: DesignNote): string {
  return [
    "| Human h | Agent h | Complexity | Confidence |",
    "|---|---|---|---|",
    `| ${note.estHumanH ?? "–"} | ${note.estAgentH ?? "–"} | ${note.complexity ?? "–"}/5 | ${note.confidence ?? "–"} |`,
    "",
    `Basis: ${note.estimateBasis || "–"}`,
  ].join("\n");
}

function planTable(note: DesignNote): string {
  const rows = note.plan.map((step, index) =>
    `| ${index + 1} | ${escapeCell(step.step)} | ${escapeCell(step.repo)} | ${escapeCell(step.locations.join(", "))} | ${escapeCell(step.change)} | ${step.agentDoable ? "yes" : "no"} |`);

  return ["| # | Step | Repo | Where | Change | Agent |", "|---|---|---|---|---|---|", ...rows].join("\n");
}

function bullets(items: string[]): string {
  return items.length > 0 ? items.map((item) => `- ${item}`).join("\n") : "None.";
}
