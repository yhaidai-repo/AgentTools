import { frontmatter } from "./frontmatter";
import { isoDate } from "./markdown";
import type { ItemNote } from "./models/ItemNote";
import { pbiNoteName } from "./paths";

const ITEM_TYPES: Record<string, string> = { research: "research-task", design: "design-task", human: "human-task", question: "question" };

export function renderItemNote(item: ItemNote, notesSection: string): string {
  return [
    frontmatter({
      id: item.id,
      type: ITEM_TYPES[item.kind] ?? item.kind,
      title: item.title,
      status: item.status,
      pbi: `[[${pbiNoteName(item.adoId)}]]`,
      assignee: item.assignee,
      run: item.runId === null ? null : `RUN-${item.runId}`,
      created_by: "agent:refinement",
      created: isoDate(item.created),
      updated: isoDate(item.updated),
      tags: ["adoa", `pbi-${item.adoId}`, ITEM_TYPES[item.kind] ?? item.kind],
      related: [`[[${pbiNoteName(item.adoId)}]]`],
    }),
    `# ${item.id} ${item.title}`,
    `PBI: [[${pbiNoteName(item.adoId)}]] · Status: ${item.status} · Assignee: ${item.assignee}`,
    ...(item.kind === "question" ? questionSections(item) : taskSections(item)),
    notesSection,
  ].join("\n\n");
}

function taskSections(item: ItemNote): string[] {
  const repos = (item.data?.repos as string[] | undefined) ?? [];

  return ["## Question", item.body ?? "–", "## Goal", String(item.data?.goal ?? "–"), "## Repos", repos.map((name) => `- \`${name}\``).join("\n") || "None."];
}

function questionSections(item: ItemNote): string[] {
  const options = (item.data?.options as string[] | undefined) ?? [];

  return [
    "## Question", item.body ?? "–",
    "## Why it matters", String(item.data?.why ?? "–"),
    "## Options", options.map((option) => `- ${option}`).join("\n") || "None given.",
    "_Answer in the adoa dashboard (or below in Notes for now)._",
  ];
}
