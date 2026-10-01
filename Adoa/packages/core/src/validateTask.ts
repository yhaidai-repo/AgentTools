import { agentRun, attachment, localItem, vaultCapture, workItem, type AdoaDb } from "@adoa/db";
import { and, eq, inArray, isNotNull, like, ne, sql } from "drizzle-orm";
import { pbiLinkedUrls } from "./urls";

type ItemRow = typeof localItem.$inferSelect;
type Check = (db: AdoaDb, task: ItemRow, agentId: string) => Promise<string[]>;

const OPEN = ["open", "in-progress"] as const;
const UNMERGED_DRAFTS = ["pending", "created", "appended"];

// One check per AgentConfig `waitFor` key (BLOCKER_KINDS); each returns the reasons it holds the task.
const CHECKS: Record<string, Check> = {
  humanItems: openHumanItems,
  linkedDocuments: documentsWithoutContent,
  drafts: unmergedDrafts,
  otherAgentTasks: otherAgentsOpenTasks,
};

// Why the agent may not start this task yet (empty = it may). Reads the DB only, so the dispatcher can check every
// task on every tick; the worker keeps the data current (merged drafts, linked documents).
export async function validateTask(db: AdoaDb, task: ItemRow, agentId: string, waitFor: string[], capabilities: { webAccess: boolean }): Promise<string[]> {
  const unknown = waitFor.filter((key) => !CHECKS[key]).map((key) => `Unknown blocker "${key}" in the agent's config`);
  const reasons = await Promise.all(waitFor.filter((key) => CHECKS[key]).map((key) => CHECKS[key](db, task, agentId)));

  return [...webAccessMissing(task, agentId, capabilities), ...unknown, ...reasons.flat()];
}

// Always checked, not a waitFor box: a task that needs the web can't be done without web access (user decision 2026-10-02).
function webAccessMissing(task: ItemRow, agentId: string, capabilities: { webAccess: boolean }): string[] {
  const needsWeb = (task.data as { needsWeb?: boolean } | null)?.needsWeb === true;

  return needsWeb && !capabilities.webAccess ? [`Needs web access: turn it on in ${agentId}'s Config, or delete this task`] : [];
}

async function openHumanItems(db: AdoaDb, task: ItemRow): Promise<string[]> {
  const rows = await db
    .select({ id: localItem.id })
    .from(localItem)
    .where(and(eq(localItem.pbiId, task.pbiId), eq(localItem.assignee, "human"), inArray(localItem.status, [...OPEN])))
    .orderBy(localItem.id);

  return rows.length > 0 ? [`Waiting for you: ${rows.map((row) => row.id).join(", ")}`] : [];
}

// A linked document is settled when its content is attached or the user closed the task asking for it.
async function documentsWithoutContent(db: AdoaDb, task: ItemRow): Promise<string[]> {
  const [pbi] = await db.select().from(workItem).where(eq(workItem.adoId, task.pbiId));
  const attached = await db.select({ url: attachment.sourceUrl }).from(attachment).where(and(eq(attachment.pbiId, task.pbiId), isNotNull(attachment.sourceUrl)));
  const declined = await db
    .select({ url: sql<string>`${localItem.data}->>'url'` })
    .from(localItem)
    .where(and(eq(localItem.pbiId, task.pbiId), eq(localItem.kind, "human"), inArray(localItem.status, ["done", "cancelled"]), sql`${localItem.data}->>'url' IS NOT NULL`));
  const settled = [...attached, ...declined].map((row) => row.url);
  const missing = pbi ? pbiLinkedUrls(pbi).filter((url) => !settled.includes(url)) : [];

  return missing.map((url) => `Linked document without content: ${url}`);
}

// Drafts the agent itself captured don't hold it back.
async function unmergedDrafts(db: AdoaDb, task: ItemRow, agentId: string): Promise<string[]> {
  const rows = await db
    .select({ name: vaultCapture.name })
    .from(vaultCapture)
    .innerJoin(agentRun, eq(agentRun.id, vaultCapture.runId))
    .where(and(eq(vaultCapture.pbiId, task.pbiId), inArray(vaultCapture.status, UNMERGED_DRAFTS), sql`${agentRun.stage}::text <> ${agentId}`));

  return rows.length > 0 ? [`Vault drafts not merged: ${rows.map((row) => row.name).join(", ")}`] : [];
}

async function otherAgentsOpenTasks(db: AdoaDb, task: ItemRow, agentId: string): Promise<string[]> {
  const rows = await db
    .select({ id: localItem.id, assignee: localItem.assignee })
    .from(localItem)
    .where(and(
      eq(localItem.pbiId, task.pbiId),
      like(localItem.assignee, "agent:%"),
      ne(localItem.assignee, `agent:${agentId}`),
      inArray(localItem.status, [...OPEN]),
    ))
    .orderBy(localItem.id);

  return rows.map((row) => `Waiting for ${row.assignee.replace("agent:", "")}: ${row.id}`);
}
