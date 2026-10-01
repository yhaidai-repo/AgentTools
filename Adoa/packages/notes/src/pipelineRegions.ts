import { localItem, refinement, vaultCapture, workItem, type AdoaDb } from "@adoa/db";
import { listAttachments } from "./attachments";
import { desc, eq } from "drizzle-orm";
import { escapeCell, refinementNoteName } from "@adoa/vault";

type WorkItemRow = typeof workItem.$inferSelect;

// Content of the PBI note's generated regions, built from the DB so every render shows the current state.
export async function pipelineRegions(db: AdoaDb, row: WorkItemRow): Promise<Record<string, string>> {
  return {
    refinement: await refinementRegion(db, row.adoId),
    items: await itemsRegion(db, row.adoId),
  };
}

async function refinementRegion(db: AdoaDb, adoId: number): Promise<string> {
  const [latest] = await db.select().from(refinement).where(eq(refinement.pbiId, adoId)).orderBy(desc(refinement.version)).limit(1);

  if (!latest) {
    return "Pending.";
  }

  return `${latest.summary}\n\nDetails: [[${refinementNoteName(adoId)}]] (v${latest.version})`;
}

// The items table, then the user's uploads and the agents' vault drafts (kept in this region so the user's PBI template needs no change).
async function itemsRegion(db: AdoaDb, adoId: number): Promise<string> {
  return [await itemsTable(db, adoId), await attachmentsTable(db, adoId), await draftsTable(db, adoId)].filter(Boolean).join("\n\n");
}

// Drafts live in the docs vault's draft/ folder; the backlog sits inside that vault, so [[name]] opens them.
async function draftsTable(db: AdoaDb, adoId: number): Promise<string | null> {
  const drafts = await db.select().from(vaultCapture).where(eq(vaultCapture.pbiId, adoId)).orderBy(vaultCapture.id);

  if (drafts.length === 0) {
    return null;
  }

  const lines = drafts.map((draft) => `| ${isInDraftFolder(draft) ? `[[${draft.name}]]` : draft.name} | ${draftState(draft)} | RUN-${draft.runId} |`);

  return ["**Vault drafts**", "", "| Draft | State | Run |", "|---|---|---|", ...lines].join("\n");
}

// A merged draft is gone from draft/ (its facts live in the target note), so only unmerged ones get a link.
function isInDraftFolder(draft: typeof vaultCapture.$inferSelect): boolean {
  return draft.status === "created" || draft.status === "appended";
}

// Every state but merged (and rejected, which is a human task instead) blocks the other agents.
const DRAFT_STATES: Record<string, string> = {
  pending: "not written yet: blocks the other agents",
  created: "waiting to be verified and merged: blocks the other agents",
  appended: "waiting to be verified and merged: blocks the other agents",
  merged: "merged",
};

function draftState(draft: typeof vaultCapture.$inferSelect): string {
  return DRAFT_STATES[draft.status] ?? `rejected: ${escapeCell(draft.errors.join("; "))} (handed to you as a human task)`;
}

async function itemsTable(db: AdoaDb, adoId: number): Promise<string> {
  const items = await db.select().from(localItem).where(eq(localItem.pbiId, adoId)).orderBy(localItem.id);

  if (items.length === 0) {
    return "None yet.";
  }

  const lines = items.map((item) => `| [[${item.id}]] | ${item.kind} | ${item.status} | ${escapeCell(item.title)} |`);

  return ["| Item | Kind | Status | Title |", "|---|---|---|---|", ...lines].join("\n");
}

async function attachmentsTable(db: AdoaDb, adoId: number): Promise<string | null> {
  const attachments = await listAttachments(db, adoId);

  if (attachments.length === 0) {
    return null;
  }

  const lines = attachments.map((entry) => `| [[${entry.vaultName}]] | ${entry.itemId ? `[[${entry.itemId}]]` : "–"} | ${entry.sourceUrl ?? "–"} |`);

  return ["**Attachments**", "", "| File | For | Content of |", "|---|---|---|", ...lines].join("\n");
}
