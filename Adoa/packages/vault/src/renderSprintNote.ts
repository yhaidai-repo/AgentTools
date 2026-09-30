import { frontmatter } from "./frontmatter";
import { escapeCell, region } from "./markdown";
import type { SprintNote } from "./models/SprintNote";
import type { SprintNoteRow } from "./models/SprintNoteRow";
import { pbiNoteName, sprintNoteName } from "./paths";

const DONE_STATE = "Done";

export function renderSprintNote(sprint: SprintNote, notesSection: string): string {
  const name = sprintNoteName(sprint.iterationPath);

  return [
    renderFrontmatter(sprint, name),
    `# ${name} ${sprint.name}`,
    region("summary", renderSummary(sprint)),
    "## PBIs",
    region("pbis", renderRows(sprint.rows)),
    notesSection,
  ].join("\n\n");
}

function renderFrontmatter(sprint: SprintNote, name: string): string {
  return frontmatter({
    id: name,
    type: "sprint",
    title: sprint.name,
    status: sprint.timeframe,
    iteration: sprint.iterationPath,
    start: sprint.startDate?.slice(0, 10) ?? null,
    finish: sprint.finishDate?.slice(0, 10) ?? null,
    created_by: "sync",
    tags: ["adoa", "sprint"],
    related: ["[[backlog-index]]"],
  });
}

function renderSummary(sprint: SprintNote): string {
  const done = sprint.rows.filter((row) => row.adoState === DONE_STATE).length;
  const dates = `${sprint.startDate?.slice(0, 10) ?? "?"} → ${sprint.finishDate?.slice(0, 10) ?? "?"}`;

  return `${dates} · ${done} of ${sprint.rows.length} PBIs done`;
}

function renderRows(rows: SprintNoteRow[]): string {
  if (rows.length === 0) {
    return "None assigned.";
  }

  const lines = rows.map((row) =>
    `| [[${pbiNoteName(row.adoId)}]] | ${escapeCell(row.title)} | ${row.adoState} | ${row.pipelineStatus} | ${row.effort ?? "–"} |`,
  );

  return ["| PBI | Title | ADO state | Pipeline | Effort |", "|---|---|---|---|---|", ...lines].join("\n");
}
