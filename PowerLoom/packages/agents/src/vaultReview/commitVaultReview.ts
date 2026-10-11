import { nextGlobalItemId } from "@powerloom/core";
import { agentRun, localItem, vaultReviewDecision, type PowerLoomDb } from "@powerloom/db";
import { eq } from "drizzle-orm";
import { insertFindings } from "../findings";
import type { VaultsAccess } from "../models/VaultsAccess";
import type { ActualizeTaskData } from "../techWriter/models/ActualizeTaskData";
import type { NoteAuthor } from "../techWriter/models/NoteAuthor";
import { withAuthor } from "../techWriter/noteAuthors";
import type { ReviewDecision } from "./models/ReviewDecision";
import type { RecordDecision } from "./models/RecordDecision";
import type { VaultChanges } from "./models/VaultChanges";
import type { VaultReviewDraft } from "./models/VaultReviewDraft";
import { linksLeftToRemoved, plannedChanges } from "./reviewChanges";
import type { ReviewScope } from "./ReviewScope";

type ItemRow = typeof localItem.$inferSelect;

const AUTHOR = "PowerLoom vault-review";
const TRASH_FOLDER = ".trash";
const TECH_WRITER = "tech-writer";

// A successful review run (user decision 2026-10-03): every vault is checked before anything is written, then link fixes
// and status changes are written, closed register records are written (user decision 2026-10-06), removed notes move to
// the vault's .trash/, actualize decisions become tech-writer tasks, and each decision is recorded so the note or record
// drops out of the lists for a while.
export async function commitVaultReview(db: PowerLoomDb, vaults: VaultsAccess, scope: ReviewScope, task: ItemRow, runId: number, draft: VaultReviewDraft): Promise<string[]> {
  const changes = await changesPerVault(scope, draft);

  for (const [vault, vaultChanges] of changes) {
    await applyChanges(vaults, scope, vault, vaultChanges, runId);
  }

  const decidedAt = new Date();
  const taskIds = await recordDecisions(db, task, runId, draft.decisions, decidedAt);

  await recordRecordDecisions(db, runId, draft.records, decidedAt);

  const findingIds = await insertFindings(db, task, runId, draft.findings);
  const outputs = [...summaryLines(draft), ...taskIds, ...findingIds];

  await db.update(agentRun).set({ outputs }).where(eq(agentRun.id, runId));
  await db.update(localItem).set({ resolution: draft.summary }).where(eq(localItem.id, task.id));

  return outputs;
}

// Checked first for every vault: a removed note may not stay linked (write_review_summary already refused that).
async function changesPerVault(scope: ReviewScope, draft: VaultReviewDraft): Promise<Map<string, VaultChanges>> {
  const touched = new Set([...draft.decisions, ...draft.linkFixes, ...draft.records].map((change) => change.vault));
  const changes = new Map<string, VaultChanges>();

  for (const vault of touched) {
    const index = await scope.index(vault);
    const vaultChanges = plannedChanges(index, draft);
    const left = linksLeftToRemoved(index, vaultChanges).map((link) => `${link.from}:${link.line} [[${link.target}]]`);

    if (left.length > 0) {
      throw new Error(`links in ${vault} still point at removed notes: ${left.join(", ")}`);
    }

    changes.set(vault, vaultChanges);
  }

  return changes;
}

async function applyChanges(vaults: VaultsAccess, scope: ReviewScope, vault: string, changes: VaultChanges, runId: number): Promise<void> {
  const writer = vaults.writer(vault);
  const author: NoteAuthor = { writer: AUTHOR, context: `RUN-${runId}`, date: new Date().toISOString().slice(0, 10) };

  for (const [path, content] of changes.edits) {
    const previous = await writer.readNote(path);

    await writer.writeNote(path, withAuthor(content, previous, author));
  }

  for (const path of changes.removed) {
    const content = (await scope.index(vault)).note(path)!.content;

    await writer.writeNote(`${TRASH_FOLDER}/${path}`, content);
    await writer.removeFile(path);
  }
}

// noteMtime is taken after the writes, so the run's own edits don't bring a decided note back.
async function recordDecisions(db: PowerLoomDb, task: ItemRow, runId: number, decisions: ReviewDecision[], decidedAt: Date): Promise<string[]> {
  const taskIds: string[] = [];

  for (const decision of decisions) {
    const taskId = decision.action === "actualize" ? await createActualizeTask(db, task, runId, decision) : null;

    await db.insert(vaultReviewDecision).values({
      vault: decision.vault, path: decision.path, action: decision.action, reasons: decision.reasons, noteMtime: decidedAt, taskId, runId, decidedAt,
    });
    taskIds.push(...(taskId ? [taskId] : []));
  }

  return taskIds;
}

// A kept record drops out of list_open_records for staleDays; a closed one isn't open any more.
async function recordRecordDecisions(db: PowerLoomDb, runId: number, decisions: RecordDecision[], decidedAt: Date): Promise<void> {
  for (const decision of decisions) {
    await db.insert(vaultReviewDecision).values({
      vault: decision.vault, path: decision.path, recordId: decision.recordId, action: decision.action, reasons: decision.reasons, noteMtime: decidedAt, runId, decidedAt,
    });
  }
}

// A tech-writer task in actualize mode (user decision 2026-10-03: a direct task, not a draft), linked to the review task.
async function createActualizeTask(db: PowerLoomDb, task: ItemRow, runId: number, decision: ReviewDecision): Promise<string> {
  const id = await nextGlobalItemId(db, "WT");
  const data: ActualizeTaskData = {
    key: `actualize:${decision.vault}:${decision.path}:RUN-${runId}`,
    mode: "actualize",
    vault: decision.vault,
    path: decision.path,
    project: decision.path.split("/")[0],
    reasons: decision.reasons,
    suspectFacts: decision.suspectFacts,
    reviewTask: task.id,
  };

  await db.insert(localItem).values({
    id,
    kind: "docs",
    pbiId: null,
    vault: decision.vault,
    parentId: task.id,
    title: `Actualize: ${decision.vault}/${decision.path}`.slice(0, 120),
    status: "open",
    assignee: `agent:${TECH_WRITER}`,
    body: [decision.reasons, ...decision.suspectFacts.map((fact) => `- ${fact}`)].join("\n"),
    data,
    createdByRun: runId,
  });

  return id;
}

function summaryLines(draft: VaultReviewDraft): string[] {
  const decisions = draft.decisions.map((decision) => `${decision.action} ${decision.vault}/${decision.path}${decision.action === "remove" ? ` → ${TRASH_FOLDER}/` : ""}`);
  const fixes = draft.linkFixes.map((fix) => `link ${fix.vault}/${fix.path}: [[${fix.target}]] → ${fix.to === null ? "plain text" : `[[${fix.to}]]`}`);
  const records = draft.records.map((record) => `${record.action} ${record.vault}/${record.path} ${record.recordId}${record.closing ? ` (${record.closing.status})` : ""}`);

  return [...decisions, ...fixes, ...records];
}
