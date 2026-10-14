import { localItem, refinement, type PowerLoomDb } from "@powerloom/db";
import { and, asc, desc, eq } from "drizzle-orm";
import type { RepoAccess } from "../models/RepoAccess";
import { buildPbiMessage } from "../refinement/pbiMessage";
import { reposBlock } from "../repos/reposBlock";
import type { ResearchContext } from "../research/models/ResearchContext";
import { refinementBlock } from "../research/researchMessage";
import { resultBlock } from "../research/researchResultBlock";
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
