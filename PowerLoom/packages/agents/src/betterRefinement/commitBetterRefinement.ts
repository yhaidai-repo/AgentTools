import { recommendPbiSkills, setItemStatus } from "@powerloom/core";
import type { PowerLoomDb } from "@powerloom/db";
import { commitRelevantPages } from "../relevantPages";
import { insertRefinement } from "../refinement/commitRefinement";
import { confirmRepos } from "../refinement/confirmRepos";
import { queueRefinementFollowUp } from "../refinement/refinementFollowUp";
import type { RefinementFollowUp } from "../refinement/models/RefinementFollowUp";
import type { CreatedTask } from "../taskCreation/models/CreatedTask";
import { USER } from "../taskCreation/taskTargets";
import type { BetterRefinementDraft } from "./models/BetterRefinementDraft";
import type { RefinementDetails } from "./models/RefinementDetails";

const NEW_TASK = /new:(\d+)/g;

type Refinement = NonNullable<BetterRefinementDraft["refinement"]>;

// Writes a run's refinement (stage 2b, 2026-10-23: a granted writer, so the toolset has written the tasks and drafts
// already; blockers point at the tasks): the refinement version with its details, the repo confirmation, skills and
// pages, and the follow-up refinement when it handed work to the user; closes the task, so a run kept after a budget
// stop ends done too. Returns what it wrote, for the run's outputs.
export async function commitBetterRefinement(
  db: PowerLoomDb,
  task: { id: string; pbiId: number; vault: string },
  runId: number,
  agentId: string,
  draft: { refinement: Refinement; pages: BetterRefinementDraft["pages"] },
  created: { tasks: CreatedTask[]; taskIds: string[] },
  extra: { docsRead: string[]; documented: Map<string, string>; docsVault: string },
): Promise<string[]> {
  const refinement = withTaskIds(draft.refinement, created.taskIds);
  const version = await insertRefinement(db, task.pbiId, runId, refinement, extra.docsRead);
  const repoQuestionIds = await confirmRepos(db, task.pbiId, runId, refinement.repos.map((repo) => repo.name), extra.documented);
  const followUpId = await queueRefinementFollowUp(db, followUpOf(task, runId, created.tasks, created.taskIds));

  await recommendPbiSkills(db, task.pbiId, refinement.skills);
  await commitRelevantPages(db, task.pbiId, draft.pages, "refinement");
  await setItemStatus(db, task.id, "in-progress", "done", `agent:${agentId}`, runId);

  return [`PBI-${task.pbiId}-refinement v${version}`, ...repoQuestionIds, ...(followUpId ? [followUpId] : [])];
}

// `taskIds` are the created tasks' ids, in the order of `tasks`.
export function followUpOf(task: { id: string; pbiId: number }, runId: number, tasks: CreatedTask[], taskIds: string[]): RefinementFollowUp {
  const idsFor = (assignee: string) => taskIds.filter((_, index) => tasks[index].assignee === assignee);

  return { pbiId: task.pbiId, runId, taskId: task.id, userItemIds: idsFor(USER), agentItemIds: idsFor("research"), designQueued: tasks.some((created) => created.assignee === "design") };
}

// A blocker names its task as new:<n> until the commit numbers it; both the details and the readable dependencies get the id.
export function withTaskIds(refinement: Refinement, taskIds: string[]): Refinement {
  const resolve = (text: string) => text.replaceAll(NEW_TASK, (ref, n: string) => taskIds[Number(n) - 1] ?? ref);
  const details: RefinementDetails = { ...refinement.details, blockers: refinement.details.blockers.map((blocker) => ({ ...blocker, resolvedBy: resolve(blocker.resolvedBy) })) };

  return { ...refinement, dependencies: refinement.dependencies.map(resolve), details };
}
