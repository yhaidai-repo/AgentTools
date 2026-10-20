import type { localItem, workItem, PowerLoomDb } from "@powerloom/db";
import type { RepoAccess } from "../models/RepoAccess";
import { buildPbiMessage } from "../refinement/pbiMessage";
import { reposBlock } from "../repos/reposBlock";
import { CHECK_EACH_CRITERION, isUserTask } from "../tasks/userTasks";

type ItemRow = typeof localItem.$inferSelect;
type WorkItemRow = typeof workItem.$inferSelect;

type TaskData = { goal?: string; depth?: number; reason?: string; outOfScope?: string | null; pullRequestId?: number; branch?: string; dependsOn?: string[] };

// The first message: the test task, the PBI with everything attached to it, and the repos. The refinement (test
// data), the design (its tests) and the test cases are one read_pbi / read_test_cases call away, named here.
export async function buildTestMessage(db: PowerLoomDb, vaultRoot: string, task: ItemRow, pbi: WorkItemRow, repos: RepoAccess): Promise<string> {
  const pbiMessage = (await buildPbiMessage(db, vaultRoot, pbi)).replace(/^Refine this PBI\.\n\n/, "");

  return [
    "Test this PBI: analyse its acceptance criteria against its test cases, then plan the cases.",
    taskBlock(task),
    pbiMessage,
    whereToLook(pbi.adoId),
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
    "</where-to-look>",
  ].join("\n");
}
