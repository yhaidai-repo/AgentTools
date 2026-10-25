import { vaultOfPbiSql } from "@powerloom/core";
import { localItem, type PowerLoomDb } from "@powerloom/db";
import { commitRelevantPages } from "../relevantPages";
import { supersedeEarlierResults } from "../research/commitResearch";
import type { ResearchResultOutput } from "../research/models/ResearchResultOutput";
import { nextId } from "../taskCreation/commitCreatedTasks";
import type { RelevantPage } from "../models/RelevantPage";
import type { BetterResearchResult } from "./models/BetterResearchResult";

const RESULT_VERSION = 2;

type ItemRow = typeof localItem.$inferSelect;

// Writes the run's research result (stage 2b, 2026-10-23: a granted writer, so the toolset has written the tasks and
// drafts already): the RR item, the relevant pages, earlier results superseded. A task without a PBI
// gets the same result item, numbered across the app; pages belong to a PBI, so it has none. Returns the item's id.
export async function commitResearchResult(
  db: PowerLoomDb,
  task: ItemRow,
  runId: number,
  agentId: string,
  draft: { result: BetterResearchResult; pages: RelevantPage[] },
  taskIds: string[],
  extra: { commits: Record<string, string>; docsRead: string[]; docsVault: string },
): Promise<string[]> {
  const actor = `agent:${agentId}`;
  const data = { ...readableResult(draft.result), result: draft.result, resultVersion: RESULT_VERSION, next: { taskIds, reason: draft.result.nextReason }, commits: extra.commits, docsRead: extra.docsRead };
  const resultId = await insertResult(db, task, runId, actor, draft.result.conclusion, data);

  if (task.pbiId !== null) {
    await commitRelevantPages(db, task.pbiId, draft.pages, "research");
  }

  await supersedeEarlierResults(db, task.id, resultId, runId);

  return [resultId];
}

async function insertResult(db: PowerLoomDb, task: ItemRow, runId: number, actor: string, conclusion: string, data: object): Promise<string> {
  const id = await nextId(db, "RR", task.pbiId);
  const vault = task.pbiId === null ? task.vault : vaultOfPbiSql(task.pbiId);

  await db.insert(localItem).values({ id, kind: "research-result", pbiId: task.pbiId, vault, parentId: task.id, title: `Result: ${task.title}`.slice(0, 120), status: "final", assignee: actor, body: conclusion, data, createdByRun: runId });

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
