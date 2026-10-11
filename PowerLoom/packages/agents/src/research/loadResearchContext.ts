import { requirePbiId } from "@powerloom/core";
import { localItem, workItem } from "@powerloom/db";
import { eq } from "drizzle-orm";
import type { AgentDeps } from "../models/AgentDeps";
import type { ResearchContext } from "./models/ResearchContext";
import { resolveRepos } from "./resolveRepos";

// The task, its PBI and the repos a run may read; research and design both work from this.
export async function loadResearchContext(deps: AgentDeps, task: typeof localItem.$inferSelect): Promise<ResearchContext> {
  const [pbi] = await deps.db.select().from(workItem).where(eq(workItem.adoId, requirePbiId(task)));
  const { repos, unknown } = await resolveRepos(deps.db, requirePbiId(task));

  return { task, pbi, repos, unknownRepos: unknown };
}
