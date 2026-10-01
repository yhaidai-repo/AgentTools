import { nextGlobalItemId, setItemStatus } from "@adoa/core";
import { localItem, vaultCapture, type AdoaDb } from "@adoa/db";
import { VaultCaptureCli, markMergedDrafts, type VaultDraft } from "@adoa/notes";
import { and, desc, eq, inArray, sql } from "drizzle-orm";

type ItemRow = typeof localItem.$inferSelect;

const ADOA_SOURCE = "session finding: adoa";
const ACTOR = "worker";
const WAITING = ["open", "blocked"] as const;

// The dedicated drafts job (user decision 2026-10-02): the only part of adoa that looks at the draft folder, and only
// through VaultCapture's draft commands. Every draft gets a tech-writer task; a task whose draft is gone is done.
export async function syncDraftTasks(db: AdoaDb): Promise<string> {
  const cli = await VaultCaptureCli.fromEnv("the drafts job lists the vault drafts");
  const drafts = await cli.listDrafts(ADOA_SOURCE);
  const created = await createMissingTasks(db, cli, drafts);
  const closed = await closeTasksOfGoneDrafts(db, cli);
  const merged = await markMergedDrafts(db);

  return `${drafts.length} draft(s): ${created} task(s) created, ${closed} closed (draft gone), ${merged} capture(s) merged`;
}

// In the listing's order (adoa's drafts first, then oldest first), so the tasks queue up the same way.
async function createMissingTasks(db: AdoaDb, cli: VaultCaptureCli, drafts: VaultDraft[]): Promise<number> {
  let created = 0;

  for (const draft of drafts) {
    created += (await createTaskIfMissing(db, cli, draft)) ? 1 : 0;
  }

  return created;
}

// The key names the draft as captured, so a later draft with the same name gets its own task.
async function createTaskIfMissing(db: AdoaDb, cli: VaultCaptureCli, draft: VaultDraft): Promise<boolean> {
  const key = `merge:${draft.name}:${draft.captured}`;
  const existing = await db.select({ id: localItem.id }).from(localItem).where(sql`${localItem.data}->>'key' = ${key}`).limit(1);

  if (existing.length > 0) {
    return false;
  }

  await db.insert(localItem).values({
    id: await nextGlobalItemId(db, "WT"),
    kind: "docs",
    pbiId: await pbiOfDraft(db, draft.name),
    title: `Merge draft: ${draftTitle(draft)}`.slice(0, 120),
    status: "open",
    assignee: "agent:tech-writer",
    body: draft.name,
    data: { key, draft: draft.name, path: cli.relativePath(draft.path), project: draft.project, target: draft.target, source: draft.source, captured: draft.captured },
  });

  return true;
}

// Draft notes often title themselves "Draft: …" or "… (draft)"; the task title says it already.
function draftTitle(draft: VaultDraft): string {
  const title = (draft.title || draft.name).replace(/^draft:\s*/i, "").replace(/\s*\(draft\)$/i, "");

  return title || draft.name;
}

// adoa's drafts come from an agent run on a PBI (vault_capture); chat drafts have none.
async function pbiOfDraft(db: AdoaDb, name: string): Promise<number | null> {
  const [capture] = await db.select({ pbiId: vaultCapture.pbiId }).from(vaultCapture).where(eq(vaultCapture.name, name)).orderBy(desc(vaultCapture.id)).limit(1);

  return capture?.pbiId ?? null;
}

// Merged or deleted outside the tech-writer (also by hand): nothing left to do. A running task is the runner's to end.
async function closeTasksOfGoneDrafts(db: AdoaDb, cli: VaultCaptureCli): Promise<number> {
  const waiting = await db.select().from(localItem).where(and(eq(localItem.kind, "docs"), inArray(localItem.status, [...WAITING])));

  if (waiting.length === 0) {
    return 0;
  }

  const stillDrafts = await cli.isDraft([...new Set(waiting.map(draftName))]);
  const gone = waiting.filter((task) => stillDrafts[draftName(task)] === false);

  for (const task of gone) {
    await db.update(localItem).set({ resolution: "The draft is no longer in draft/ (merged or deleted outside the tech-writer)." }).where(eq(localItem.id, task.id));
    await setItemStatus(db, task.id, task.status, "done", ACTOR);
  }

  return gone.length;
}

function draftName(task: ItemRow): string {
  return String((task.data as { draft?: string } | null)?.draft ?? task.body);
}
