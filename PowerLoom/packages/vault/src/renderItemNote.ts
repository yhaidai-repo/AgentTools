import { frontmatter } from "./frontmatter";
import { isoDate } from "./markdown";
import type { ItemNote } from "./models/ItemNote";
import { pbiNoteName } from "./paths";
import { appendUserNotes } from "./notesSection";

const ITEM_TYPES: Record<string, string> = {
  research: "research-task",
  design: "design-task",
  human: "human-task",
  question: "question",
  "research-result": "research-result",
};

type Sections = (item: ItemNote) => string[];

const SECTIONS: Record<string, Sections> = {
  question: questionSections,
  human: humanTaskSections,
  "research-result": researchResultSections,
};

export function renderItemNote(item: ItemNote, notesSection: string): string {
  const parentLink = item.parentId ? ` · From: [[${item.parentId}]]` : "";
  const sections = SECTIONS[item.kind] ?? taskSections;

  return appendUserNotes([
    frontmatter({
      id: item.id,
      type: ITEM_TYPES[item.kind] ?? item.kind,
      title: item.title,
      status: item.status,
      pbi: `[[${pbiNoteName(item.adoId)}]]`,
      parent: item.parentId ? `[[${item.parentId}]]` : null,
      assignee: item.assignee,
      run: item.runId === null ? null : `RUN-${item.runId}`,
      created_by: item.parentId ? "agent:research" : "agent:refinement",
      created: isoDate(item.created),
      updated: isoDate(item.updated),
      tags: ["powerloom", `pbi-${item.adoId}`, ITEM_TYPES[item.kind] ?? item.kind],
      related: [`[[${pbiNoteName(item.adoId)}]]`],
    }),
    `# ${item.id} ${item.title}`,
    `PBI: [[${pbiNoteName(item.adoId)}]]${parentLink} · Status: ${item.status} · Assignee: ${item.assignee}`,
    ...sections(item),
  ].join("\n\n"), notesSection);
}

// A research task reads the PBI's repos, so it lists none of its own (user decision 2026-10-13).
function taskSections(item: ItemNote): string[] {
  return ["## Question", item.body ?? "–", "## Goal", String(item.data?.goal ?? "–")];
}

function humanTaskSections(item: ItemNote): string[] {
  return ["## Task", item.body ?? "–", ...closedSection(item, "## Outcome", "_Close it on the PBI's page in PowerLoom._")];
}

function questionSections(item: ItemNote): string[] {
  const options = list<string>(item, "options").map((option) => `- ${option}`);

  return [
    "## Question", item.body ?? "–",
    "## Why it matters", String(item.data?.why ?? "–"),
    "## Options", options.join("\n") || "None given.",
    ...closedSection(item, "## Answer", "_Answer on the PBI's page in PowerLoom._"),
  ];
}

// Open items say where to close them; closed ones show what the person answered and uploaded.
function closedSection(item: ItemNote, heading: string, openHint: string): string[] {
  if (item.status === "open") {
    return [openHint];
  }

  const files = item.attachments.map((name) => `- [[${name}]]`);

  return [heading, `${item.status}: ${item.resolution ?? "–"}`, ...(files.length > 0 ? [files.join("\n")] : [])];
}

function researchResultSections(item: ItemNote): string[] {
  const evidence = list<{ location: string; note: string }>(item, "evidence").map((entry) => `- \`${entry.location}\`: ${entry.note}`);
  const docs = list<{ path: string; why: string }>(item, "relevantDocs").map((doc) => `- \`${doc.path}\`: ${doc.why}`);
  const code = list<{ location: string; why: string }>(item, "codeRefs").map((ref) => `- \`${ref.location}\`: ${ref.why}`);
  const commits = Object.entries((item.data?.commits as Record<string, string> | undefined) ?? {}).map(([repo, sha]) => `- ${repo} @ \`${sha.slice(0, 10)}\``);

  return [
    "## Conclusion", item.body ?? "–",
    `Confidence: **${String(item.data?.confidence ?? "–")}**`,
    "## Findings", list<string>(item, "findings").map((finding) => `- ${finding}`).join("\n") || "None.",
    "## Evidence", evidence.join("\n") || "None.",
    "## For design: docs", docs.join("\n") || "None.",
    "## For design: code", code.join("\n") || "None.",
    "## Code version read", commits.join("\n") || "No repos.",
  ];
}

function list<T>(item: ItemNote, field: string): T[] {
  return (item.data?.[field] as T[] | undefined) ?? [];
}
