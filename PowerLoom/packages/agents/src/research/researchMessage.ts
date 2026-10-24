import { refinement, type PowerLoomDb } from "@powerloom/db";
import { desc, eq } from "drizzle-orm";
import type { RepoAccess } from "../models/RepoAccess";
import { buildPbiMessage } from "../refinement/pbiMessage";
import { reposBlock } from "../repos/reposBlock";
import { CHECK_EACH_CRITERION, isUserTask } from "../tasks/userTasks";
import type { RefinementDetails } from "../betterRefinement/models/RefinementDetails";
import type { ResearchContext } from "./models/ResearchContext";

type ItemRow = ResearchContext["task"];

// The first message: the task, the PBI, the refinement and what refinement found worth reading.
export async function buildResearchMessage(db: PowerLoomDb, vaultRoot: string, context: ResearchContext, repos: RepoAccess): Promise<string> {
  const [latest] = await db.select().from(refinement).where(eq(refinement.pbiId, context.pbi.adoId)).orderBy(desc(refinement.version)).limit(1);
  const pbi = (await buildPbiMessage(db, vaultRoot, context.pbi)).replace(/^Refine this PBI\.\n\n/, "");

  return [
    "Answer this research task.",
    taskBlock(context.task),
    pbi,
    latest ? refinementBlock(latest) : "<refinement>none</refinement>",
    reposBlock(repos),
  ].join("\n\n");
}

// A research task without a PBI (e.g. one the user created on the Tasks page): the task and the repos it names.
export function buildTaskResearchMessage(task: ItemRow, repos: RepoAccess): string {
  return ["Answer this research task. It belongs to no PBI.", taskBlock(task), reposBlock(repos)].join("\n\n");
}

function taskBlock(task: ItemRow): string {
  const data = (task.data ?? {}) as TaskData;

  return [
    "<task>",
    `Id: ${task.id}`,
    `Title: ${task.title}`,
    `Question: ${task.body ?? task.title}`,
    `Goal: ${data.goal ?? data.why ?? "-"}`,
    ...(isUserTask(task) ? [`Created by the user: the goal holds the acceptance criteria. ${CHECK_EACH_CRITERION}`] : []),
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
    ...refinementDetailLines(latest.details as RefinementDetails | null),
    "</refinement>",
  ].join("\n");
}

// What Better Refinement adds (refinement.details): where the change lands, what testing needs, what still blocks it.
function refinementDetailLines(details: RefinementDetails | null): string[] {
  if (!details) {
    return [];
  }

  const areas = details.affectedAreas.map((area) => `- ${area.area}: ${area.change}`);
  const blockers = details.blockers.map((blocker) => `- ${blocker.what} (resolved by ${blocker.resolvedBy})`);
  const testData = details.testData.applicable ? [...details.testData.given.map((item) => `- given: ${item.what}`), ...details.testData.missing.map((item) => `- missing: ${item}`)] : [`- not applicable: ${details.testData.reason}`];

  return [
    `Status: ${details.status}`,
    `Affected areas:\n${areas.join("\n") || "- none"}`,
    `Test data:\n${testData.join("\n") || "- none"}`,
    `Blockers:\n${blockers.join("\n") || "- none"}`,
  ];
}
