import { setItemStatus, vaultOfPbiSql } from "@powerloom/core";
import { agentRun, localItem, type PowerLoomDb, type workItem } from "@powerloom/db";
import { eq } from "drizzle-orm";
import { commitRelevantPages } from "../relevantPages";
import { supersedeEarlierResults } from "../research/commitResearch";
import type { ResearchResultOutput } from "../research/models/ResearchResultOutput";
import { commitCreatedTasks, nextId } from "../taskCreation/commitCreatedTasks";
import { commitCaptures } from "../vaultCapture";
import type { BetterResearchDraft } from "./models/BetterResearchDraft";
import type { BetterResearchResult } from "./models/BetterResearchResult";

const ACTOR = "agent:better-research";
const RESULT_VERSION = 2;

type ItemRow = typeof localItem.$inferSelect;
type WorkItemRow = typeof workItem.$inferSelect;

// Writes a successful run: the result, the tasks it created, drafts and pages; closes the task. A task without a PBI
// gets the same result item, numbered across the app; drafts and pages belong to a PBI, so it has none.
export async function commitBetterResearch(
  db: PowerLoomDb,
  task: ItemRow,
  pbi: WorkItemRow | null,
  runId: number,
  draft: BetterResearchDraft & { result: BetterResearchResult },
  extra: { commits: Record<string, string>; docsRead: string[]; docsVault: string },
): Promise<string[]> {
  const pbiId = pbi?.adoId ?? null;
  const depth = Number((task.data as { depth?: number } | null)?.depth ?? 1);
  const taskIds = await commitCreatedTasks(db, { pbiId, vault: task.vault, parentTaskId: task.id, runId, depth, docsVault: extra.docsVault }, draft.tasks);
  const data = { ...readableResult(draft.result), result: draft.result, resultVersion: RESULT_VERSION, next: { taskIds, reason: draft.result.nextReason }, commits: extra.commits, docsRead: extra.docsRead };
  const resultId = await insertResult(db, task, pbiId, runId, draft.result.conclusion, data);
  const captureIds = pbiId === null ? [] : await commitCaptures(db, runId, pbiId, task.id, draft.captures);
  const outputs = [resultId, ...taskIds, ...captureIds];

  if (pbiId !== null) {
    await commitRelevantPages(db, pbiId, draft.pages, "research");
  }

  await supersedeEarlierResults(db, task.id, resultId, runId);
  await db.update(agentRun).set({ outputs }).where(eq(agentRun.id, runId));
  await setItemStatus(db, task.id, "in-progress", "done", ACTOR, runId);

  return outputs;
}

async function insertResult(db: PowerLoomDb, task: ItemRow, pbiId: number | null, runId: number, conclusion: string, data: object): Promise<string> {
  const id = await nextId(db, "RR", pbiId);
  const vault = pbiId === null ? task.vault : vaultOfPbiSql(pbiId);

  await db.insert(localItem).values({ id, kind: "research-result", pbiId, vault, parentId: task.id, title: `Result: ${task.title}`.slice(0, 120), status: "final", assignee: ACTOR, body: conclusion, data, createdByRun: runId });

  return id;
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
