import { localItem, refinement, type PowerLoomDb } from "@powerloom/db";
import { and, asc, desc, eq } from "drizzle-orm";
import type { RepoAccess } from "../models/RepoAccess";
import { buildPbiMessage } from "../refinement/pbiMessage";
import { reposBlock } from "../repos/reposBlock";
import type { ResearchContext } from "../research/models/ResearchContext";
import type { ResearchResultOutput } from "../research/models/ResearchResultOutput";
import { refinementBlock } from "../research/researchMessage";
import { userRequestBlock } from "../tasks/userTasks";

type ItemRow = typeof localItem.$inferSelect;

// The first message: the PBI, its refinement, every research result and the repos.
export async function buildDesignMessage(db: PowerLoomDb, vaultRoot: string, context: ResearchContext, repos: RepoAccess): Promise<string> {
  const [latest] = await db.select().from(refinement).where(eq(refinement.pbiId, context.pbi.adoId)).orderBy(desc(refinement.version)).limit(1);
  const pbi = (await buildPbiMessage(db, vaultRoot, context.pbi)).replace(/^Refine this PBI\.\n\n/, "");

  return [
    `Design the implementation of this PBI (task ${context.task.id}).`,
    userRequestBlock(context.task),
    pbi,
    latest ? refinementBlock(latest) : "<refinement>none</refinement>",
    await researchBlock(db, context.pbi.adoId),
    reposBlock(repos),
  ].filter(Boolean).join("\n\n");
}

async function researchBlock(db: PowerLoomDb, adoId: number): Promise<string> {
  const tasks = await db.select().from(localItem).where(and(eq(localItem.pbiId, adoId), eq(localItem.kind, "research"))).orderBy(asc(localItem.id));
  const results = await db
    .select()
    .from(localItem)
    .where(and(eq(localItem.pbiId, adoId), eq(localItem.kind, "research-result"), eq(localItem.status, "final")))
    .orderBy(asc(localItem.id));

  if (results.length === 0) {
    return "<research>none</research>";
  }

  return ["<research>", ...results.map((result) => resultBlock(result, tasks.find((task) => task.id === result.parentId))), "</research>"].join("\n");
}

function resultBlock(result: ItemRow, task: ItemRow | undefined): string {
  const data = result.data as ResearchResultOutput;

  return [
    `## ${result.id} for ${task?.id ?? "?"}: ${task?.body ?? task?.title ?? result.title}`,
    `Conclusion (${data.confidence}): ${data.conclusion}`,
    `Findings:\n${lines(data.findings)}`,
    `Evidence:\n${lines(data.evidence.map((item) => `${item.location}: ${item.note}`))}`,
    `Docs for design:\n${lines(data.relevantDocs.map((doc) => `${doc.path}: ${doc.why}`))}`,
    `Code for design:\n${lines(data.codeRefs.map((ref) => `${ref.location}: ${ref.why}`))}`,
  ].join("\n");
}

function lines(items: string[]): string {
  return items.length > 0 ? items.map((item) => `- ${item}`).join("\n") : "- none";
}
