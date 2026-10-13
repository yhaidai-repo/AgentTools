import { refinement, type PowerLoomDb } from "@powerloom/db";
import { desc, eq } from "drizzle-orm";
import { buildPbiMessage } from "../refinement/pbiMessage";
import type { ResearchContext } from "./models/ResearchContext";

// The first message: the task, the PBI, the refinement and what refinement found worth reading.
export async function buildResearchMessage(db: PowerLoomDb, vaultRoot: string, context: ResearchContext, commits: Record<string, string>): Promise<string> {
  const [latest] = await db.select().from(refinement).where(eq(refinement.pbiId, context.pbi.adoId)).orderBy(desc(refinement.version)).limit(1);
  const pbi = (await buildPbiMessage(db, vaultRoot, context.pbi)).replace(/^Refine this PBI\.\n\n/, "");

  return [
    "Answer this research task.",
    taskBlock(context),
    pbi,
    latest ? refinementBlock(latest) : "<refinement>none</refinement>",
    reposBlock(context, commits),
  ].join("\n\n");
}

function taskBlock(context: ResearchContext): string {
  const data = (context.task.data ?? {}) as TaskData;

  return [
    "<task>",
    `Id: ${context.task.id}`,
    `Title: ${context.task.title}`,
    `Question: ${context.task.body ?? context.task.title}`,
    `Goal: ${data.goal ?? data.why ?? "-"}`,
    `Depth: ${data.depth ?? 1}`,
    ...(data.needsWeb ? [`Needs web research: yes. Use your web tools first. Suggested sources: ${data.sources?.join(", ") || "none"}`] : []),
    ...createdTaskLines(data),
    "</task>",
  ].join("\n");
}

type TaskData = {
  goal?: string;
  depth?: number;
  needsWeb?: boolean;
  why?: string;
  sources?: string[];
  outOfScope?: string | null;
  effort?: string;
  reason?: string;
  evidence?: { ref: string; note: string }[];
  dependsOn?: string[];
};

// What a task created with create_task (chaining v2) adds: its scope, effort, why it was created and on what evidence.
function createdTaskLines(data: TaskData): string[] {
  if (!data.reason) {
    return [];
  }

  const evidence = (data.evidence ?? []).map((item) => `- ${item.ref}: ${item.note}`);

  return [
    `Out of scope: ${data.outOfScope || "-"}`,
    `Effort: ${data.effort ?? "-"}`,
    `Why it was created: ${data.reason}`,
    `Evidence it rests on (read by the creating run; re-read what you rely on):\n${evidence.join("\n") || "- none"}`,
    `Depends on: ${data.dependsOn?.join(", ") || "-"}`,
  ];
}

export function refinementBlock(latest: typeof refinement.$inferSelect): string {
  const docs = latest.relevantDocs.map((doc) => `- ${doc.path}: ${doc.why}`);
  const read = latest.docsRead.map((path) => `- ${path}`);

  return [
    `<refinement version="${latest.version}">`,
    `Summary: ${latest.summary}`,
    `Dependencies:\n${latest.dependencies.map((item) => `- ${item}`).join("\n") || "- none"}`,
    `Assumptions:\n${latest.assumptions.map((item) => `- ${item}`).join("\n") || "- none"}`,
    `Relevant docs (chosen by refinement):\n${docs.join("\n") || "- none"}`,
    `Docs refinement read:\n${read.join("\n") || "- none"}`,
    "</refinement>",
  ].join("\n");
}

export function reposBlock(context: ResearchContext, commits: Record<string, string>): string {
  const available = context.repos.map((repo) => `- ${repo.name} @ ${commits[repo.name]?.slice(0, 10) ?? "?"} (branch ${repo.defaultBranch})`);
  const unknown = context.unknownRepos.map((name) => `- ${name}: not in the repo catalog`);

  return ["<repos>", ...available, ...unknown, "</repos>"].join("\n");
}
