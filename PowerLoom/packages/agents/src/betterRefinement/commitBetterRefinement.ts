import { recommendPbiSkills, setItemStatus } from "@powerloom/core";
import { agentRun, type PowerLoomDb } from "@powerloom/db";
import { eq } from "drizzle-orm";
import { commitRelevantPages } from "../relevantPages";
import { insertRefinement } from "../refinement/commitRefinement";
import { confirmRepos } from "../refinement/confirmRepos";
import { commitCreatedTasks } from "../taskCreation/commitCreatedTasks";
import { commitCaptures } from "../vaultCapture";
import type { BetterRefinementDraft } from "./models/BetterRefinementDraft";
import type { RefinementDetails } from "./models/RefinementDetails";

const ACTOR = "agent:better-refinement";
const NEW_TASK = /new:(\d+)/g;

type Refinement = NonNullable<BetterRefinementDraft["refinement"]>;

// Writes a run's draft: the tasks first (blockers point at them), then the refinement version with its details, the repo
// confirmation, drafts, skills and pages; closes the task, so a run kept after a budget stop ends done too.
export async function commitBetterRefinement(
  db: PowerLoomDb,
  task: { id: string; pbiId: number; vault: string },
  runId: number,
  draft: BetterRefinementDraft & { refinement: Refinement },
  extra: { docsRead: string[]; documented: Map<string, string>; docsVault: string },
): Promise<string[]> {
  const taskIds = await commitCreatedTasks(db, { pbiId: task.pbiId, vault: task.vault, parentTaskId: task.id, runId, depth: 0, docsVault: extra.docsVault }, draft.tasks);
  const refinement = withTaskIds(draft.refinement, taskIds);
  const version = await insertRefinement(db, task.pbiId, runId, refinement, extra.docsRead);
  const repoQuestionIds = await confirmRepos(db, task.pbiId, runId, refinement.repos.map((repo) => repo.name), extra.documented);
  const captureIds = await commitCaptures(db, runId, task.pbiId, task.id, draft.captures);
  const outputs = [`PBI-${task.pbiId}-refinement v${version}`, ...taskIds, ...repoQuestionIds, ...captureIds];

  await recommendPbiSkills(db, task.pbiId, refinement.skills);
  await commitRelevantPages(db, task.pbiId, draft.pages, "refinement");
  await db.update(agentRun).set({ outputs }).where(eq(agentRun.id, runId));
  await setItemStatus(db, task.id, "in-progress", "done", ACTOR, runId);

  return outputs;
}

// A blocker names its task as new:<n> until the commit numbers it; both the details and the readable dependencies get the id.
export function withTaskIds(refinement: Refinement, taskIds: string[]): Refinement {
  const resolve = (text: string) => text.replaceAll(NEW_TASK, (ref, n: string) => taskIds[Number(n) - 1] ?? ref);
  const details: RefinementDetails = { ...refinement.details, blockers: refinement.details.blockers.map((blocker) => ({ ...blocker, resolvedBy: resolve(blocker.resolvedBy) })) };

  return { ...refinement, dependencies: refinement.dependencies.map(resolve), details };
}
