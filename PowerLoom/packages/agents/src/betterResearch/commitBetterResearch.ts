import { setItemStatus } from "@powerloom/core";
import { agentRun, type PowerLoomDb } from "@powerloom/db";
import { eq } from "drizzle-orm";
import { commitRelevantPages } from "../relevantPages";
import { insertItem, supersedeEarlierResults } from "../research/commitResearch";
import type { ResearchContext } from "../research/models/ResearchContext";
import type { ResearchResultOutput } from "../research/models/ResearchResultOutput";
import { commitCreatedTasks } from "../taskCreation/commitCreatedTasks";
import { commitCaptures } from "../vaultCapture";
import type { BetterResearchDraft } from "./models/BetterResearchDraft";
import type { BetterResearchResult } from "./models/BetterResearchResult";

const ACTOR = "agent:better-research";
const RESULT_VERSION = 2;

// Writes a successful run: the result, the tasks it created, drafts and pages; closes the task.
export async function commitBetterResearch(
  db: PowerLoomDb,
  context: ResearchContext,
  runId: number,
  draft: BetterResearchDraft & { result: BetterResearchResult },
  extra: { commits: Record<string, string>; docsRead: string[]; docsVault: string },
): Promise<string[]> {
  const { task, pbi } = context;
  const depth = Number((task.data as { depth?: number } | null)?.depth ?? 1);
  const taskIds = await commitCreatedTasks(db, { pbiId: pbi.adoId, parentTaskId: task.id, runId, depth, docsVault: extra.docsVault }, draft.tasks);
  const data = { ...readableResult(draft.result), result: draft.result, resultVersion: RESULT_VERSION, next: { taskIds, reason: draft.result.nextReason }, commits: extra.commits, docsRead: extra.docsRead };
  const resultId = await insertItem(db, "RR", "research-result", context, runId, `Result: ${task.title}`, "final", draft.result.conclusion, data, ACTOR);
  const captureIds = await commitCaptures(db, runId, pbi.adoId, task.id, draft.captures);
  const outputs = [resultId, ...taskIds, ...captureIds];

  await commitRelevantPages(db, pbi.adoId, draft.pages, "research");
  await supersedeEarlierResults(db, task.id, resultId, runId);
  await db.update(agentRun).set({ outputs }).where(eq(agentRun.id, runId));
  await setItemStatus(db, task.id, "in-progress", "done", ACTOR, runId);

  return outputs;
}

// The fields every reader of a research result already shows (design's message, the PBI notes, the item page); the bug
// and option blocks become findings there, so nothing is lost before the readers learn the full result.
export function readableResult(result: BetterResearchResult): ResearchResultOutput {
  return {
    conclusion: result.conclusion,
    findings: [...result.findings.map(findingLine), ...bugLines(result), ...result.options.map(optionLine), ...result.notFound.map((item) => `Not found: ${item.what} (looked: ${item.looked})`)],
    evidence: [...result.findings, ...result.options].flatMap((item) => item.evidence.map((evidence) => ({ location: evidence.ref, note: evidence.note }))),
    confidence: result.confidence,
    relevantDocs: result.relevantDocs,
    codeRefs: result.startPoints,
  };
}

function findingLine(finding: BetterResearchResult["findings"][number]): string {
  return finding.certainty === "inferred" ? `${finding.fact} (inferred)` : finding.fact;
}

function bugLines(result: BetterResearchResult): string[] {
  if (!result.bug) {
    return [];
  }

  return [`Cause: ${result.bug.cause}`, `Premise checked: ${result.bug.premiseChecked}`, `Fixing the cause alone is enough: ${result.bug.fixAloneIsEnough} – ${result.bug.fixAloneReason}`];
}

function optionLine(option: BetterResearchResult["options"][number]): string {
  return `Option: ${option.option}. Pros: ${option.pros || "–"}. Cons: ${option.cons || "–"}`;
}
