import { requirePbiId } from "@powerloom/core";
import { localItem, workItem } from "@powerloom/db";
import { eq } from "drizzle-orm";
import type { AgentDeps } from "../models/AgentDeps";
import type { ResearchContext } from "./models/ResearchContext";

// The task and its PBI; research and design both work from this.
export async function loadResearchContext(deps: AgentDeps, task: typeof localItem.$inferSelect): Promise<ResearchContext> {
  const [pbi] = await deps.db.select().from(workItem).where(eq(workItem.adoId, requirePbiId(task)));

  return { task, pbi };
}
