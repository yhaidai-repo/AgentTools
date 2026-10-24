import { and, eq } from "drizzle-orm";
import { pullRequest, type localItem, type workItem, type PowerLoomDb } from "@powerloom/db";
import type { RepoAccess } from "../models/RepoAccess";
import { buildPbiMessage } from "../refinement/pbiMessage";
import { reposBlock } from "../repos/reposBlock";
import { CHECK_EACH_CRITERION, isUserTask } from "../tasks/userTasks";
import { loadChildBugs } from "./childBugs";
import type { ChildBug } from "./models/ChildBug";
import type { PreviousReport } from "./models/PreviousReport";
import { childBugsBlock } from "./renderChildBugs";
import { loadPreviousReport } from "./previousReport";
import { previousReportBlock } from "./renderPreviousReport";

type ItemRow = typeof localItem.$inferSelect;
type WorkItemRow = typeof workItem.$inferSelect;

const PC_BRANCH = "The branch is only on this PC, not pushed: start_stack builds it from the PC's checkout, so start it as named. The Azure DevOps and code tools can't see it; that is no reason to ask for a push.";

type TaskData = { goal?: string; depth?: number; reason?: string; outOfScope?: string | null; pullRequestId?: number; branch?: string; repo?: string; dependsOn?: string[]; userNotes?: string };

// The first message: the test task, the PBI with everything attached to it, the task's latest report when it has
// one, and the repos. The refinement (test data), the design (its tests) and the test cases are one read_pbi /
// read_test_cases call away, named here.
export async function buildTestMessage(db: PowerLoomDb, vaultRoot: string, task: ItemRow, pbi: WorkItemRow, repos: RepoAccess): Promise<string> {
  const pbiMessage = (await buildPbiMessage(db, vaultRoot, pbi)).replace(/^Refine this PBI\.\n\n/, "");
  const previous = await loadPreviousReport(db, task.id);
  const branchOnPc = await isBranchOnlyOnPc(db, pbi.vault, task);
  const bugs = await loadChildBugs(db, pbi.adoId);

  return composeTestMessage(task, pbi.adoId, pbiMessage, previous, repos, branchOnPc, bugs);
}

// The branch under test is a branch review of a branch that isn't pushed (origin pc, user 2026-10-21): DevHub builds it
// from the PC's checkout, while the Azure DevOps and code tools don't see it. Read on every run, so a push ends it.
async function isBranchOnlyOnPc(db: PowerLoomDb, vault: string, task: ItemRow): Promise<boolean> {
  const { branch, repo } = (task.data ?? {}) as TaskData;

  if (!branch || !repo) {
    return false;
  }

  const rows = await db.select({ id: pullRequest.id }).from(pullRequest)
    .where(and(eq(pullRequest.vault, vault), eq(pullRequest.repoName, repo), eq(pullRequest.sourceRef, `refs/heads/${branch}`), eq(pullRequest.origin, "pc"), eq(pullRequest.isListed, true)))
    .limit(1);

  return rows.length > 0;
}

// A task with a report continues it: the plan is executed, not derived again.
export function composeTestMessage(task: ItemRow, pbiId: number, pbiMessage: string, previous: PreviousReport | null, repos: RepoAccess, branchOnPc = false, bugs: ChildBug[] = []): string {
  const opening = previous ? "Test this PBI: continue from the task's latest report below, running the cases that have no pass yet." : "Test this PBI: analyse its acceptance criteria against its test cases, then plan the cases.";

  return [
    opening,
    taskBlock(task, branchOnPc),
    taskNotesBlock(task),
    pbiMessage,
    ...(previous ? [previousReportBlock(previous)] : []),
    ...(bugs.length > 0 ? [childBugsBlock(bugs)] : []),
    whereToLook(pbiId),
    reposBlock(repos),
  ].join("\n\n");
}

function taskBlock(task: ItemRow, branchOnPc: boolean): string {
  const data = (task.data ?? {}) as TaskData;

  return [
    "<task>",
    `Id: ${task.id}`,
    `Title: ${task.title}`,
    `Goal: ${data.goal ?? task.body ?? task.title}`,
    ...(isUserTask(task) ? [`Created by the user: the goal holds the acceptance criteria. ${CHECK_EACH_CRITERION}`] : []),
    ...(data.branch ? [`Branch under test: ${data.branch}`] : []),
    ...(data.branch && branchOnPc ? [PC_BRANCH] : []),
    ...(data.pullRequestId ? [`Pull request: ${data.pullRequestId}`] : []),
    ...(data.reason ? [`Why it was created: ${data.reason}`] : []),
    ...(data.outOfScope ? [`Out of scope: ${data.outOfScope}`] : []),
    ...(data.dependsOn?.length ? [`Waited for: ${data.dependsOn.join(", ")} (their answers are in the items above)`] : []),
    `Depth: ${data.depth ?? 1}`,
    "</task>",
  ].join("\n");
}

// The user's own notes on this test task (user decision 2026-10-21): data, environment or cases to check first.
function taskNotesBlock(task: ItemRow): string {
  const notes = ((task.data ?? {}) as TaskData).userNotes?.trim();

  return notes ? `<task-notes>\nThe user's notes on this test task; follow them where they apply:\n${notes}\n</task-notes>` : "<task-notes>none</task-notes>";
}

function whereToLook(pbiId: number): string {
  return [
    "<where-to-look>",
    `- read_test_cases: the Azure DevOps test cases of PBI-${pbiId} (then read_pbi("TC-<id>") for one in full).`,
    `- read_pbi("PBI-${pbiId}:refinement"): the refinement, with the test data it found or asked for.`,
    `- read_pbi("PBI-${pbiId}:design"): the design and the tests it proposed.`,
    "- The items above: answers to earlier questions, including an approval of an earlier plan.",
    "- read_pbi(\"TR-<id>\"): an earlier report in full, when the previous-report block above isn't enough.",
    "</where-to-look>",
  ].join("\n");
}
