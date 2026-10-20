import type { localItem, workItem, PowerLoomDb } from "@powerloom/db";
import type { RepoAccess } from "../models/RepoAccess";
import { buildPbiMessage } from "../refinement/pbiMessage";
import { reposBlock } from "../repos/reposBlock";
import { CHECK_EACH_CRITERION, isUserTask } from "../tasks/userTasks";
import type { PreviousReport } from "./models/PreviousReport";
import { loadPreviousReport } from "./previousReport";
import { previousReportBlock } from "./renderPreviousReport";

type ItemRow = typeof localItem.$inferSelect;
type WorkItemRow = typeof workItem.$inferSelect;

type TaskData = { goal?: string; depth?: number; reason?: string; outOfScope?: string | null; pullRequestId?: number; branch?: string; dependsOn?: string[] };

// The first message: the test task, the PBI with everything attached to it, the task's latest report when it has
// one, and the repos. The refinement (test data), the design (its tests) and the test cases are one read_pbi /
// read_test_cases call away, named here.
export async function buildTestMessage(db: PowerLoomDb, vaultRoot: string, task: ItemRow, pbi: WorkItemRow, repos: RepoAccess): Promise<string> {
  const pbiMessage = (await buildPbiMessage(db, vaultRoot, pbi)).replace(/^Refine this PBI\.\n\n/, "");
  const previous = await loadPreviousReport(db, task.id);

  return composeTestMessage(task, pbi.adoId, pbiMessage, previous, repos);
}

// A task with a report continues it: the plan is executed, not derived again.
export function composeTestMessage(task: ItemRow, pbiId: number, pbiMessage: string, previous: PreviousReport | null, repos: RepoAccess): string {
  const opening = previous ? "Test this PBI: continue from the task's latest report below, running the cases that have no pass yet." : "Test this PBI: analyse its acceptance criteria against its test cases, then plan the cases.";

  return [
    opening,
    taskBlock(task),
    pbiMessage,
    ...(previous ? [previousReportBlock(previous)] : []),
    whereToLook(pbiId),
    reposBlock(repos),
  ].join("\n\n");
}

function taskBlock(task: ItemRow): string {
  const data = (task.data ?? {}) as TaskData;

  return [
    "<task>",
    `Id: ${task.id}`,
    `Title: ${task.title}`,
    `Goal: ${data.goal ?? task.body ?? task.title}`,
    ...(isUserTask(task) ? [`Created by the user: the goal holds the acceptance criteria. ${CHECK_EACH_CRITERION}`] : []),
    ...(data.branch ? [`Branch under test: ${data.branch}`] : []),
    ...(data.pullRequestId ? [`Pull request: ${data.pullRequestId}`] : []),
    ...(data.reason ? [`Why it was created: ${data.reason}`] : []),
    ...(data.outOfScope ? [`Out of scope: ${data.outOfScope}`] : []),
    ...(data.dependsOn?.length ? [`Waited for: ${data.dependsOn.join(", ")} (their answers are in the items above)`] : []),
    `Depth: ${data.depth ?? 1}`,
    "</task>",
  ].join("\n");
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
