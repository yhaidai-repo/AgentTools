import { randomUUID } from "node:crypto";
import { agentRun, localItem, type PowerLoomDb } from "@powerloom/db";
import type { ConversationStore } from "@agenttools/runtime";
import { desc, eq } from "drizzle-orm";
import type { AgentDeps } from "../models/AgentDeps";
import type { AgentRunInfo } from "../models/AgentRunInfo";
import type { ConversationPlan } from "./models/ConversationPlan";
import type { PreviousRun } from "./models/PreviousRun";

type RunRow = typeof agentRun.$inferSelect;

// A conversation older than this starts over: the code and notes it read have likely moved on (user decision 2026-10-19).
const MAX_AGE_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;
const FINISHED_OUTCOMES: RunRow["outcome"][] = ["success", "running"];
// A guard only: a task's chain ends at its agent's maxFailures or a budget stop long before this.
const MAX_HOPS = 20;

// Every task run that follows a run without success continues that run's conversation (user decision 2026-10-19: max
// turns, budget, timeout, abort, error and a runner restart alike), unless one of the fresh-start reasons holds. A run
// without a task has no next run, so it keeps no conversation.
export async function planConversation(deps: AgentDeps, info: AgentRunInfo): Promise<ConversationPlan> {
  const conversations = deps.runtimes.get(info.model.provider).conversations;

  if (!conversations || !info.itemId) {
    return { id: null, continues: null, skipped: null };
  }

  const id = randomUUID();
  const previous = await unfinishedRun(deps.db, info.itemId);

  if (!previous) {
    return { id, continues: null, skipped: null };
  }

  return { id, ...(await continuation(deps.db, conversations, info, previous)) };
}

/** The task's next run continues again; "Start over" holds for one run only. */
export async function clearStartOver(db: PowerLoomDb, itemId: string | undefined): Promise<void> {
  if (itemId) {
    await db.update(localItem).set({ startOver: false }).where(eq(localItem.id, itemId));
  }
}

async function unfinishedRun(db: PowerLoomDb, itemId: string): Promise<RunRow | null> {
  const [last] = await db.select().from(agentRun).where(eq(agentRun.itemId, itemId)).orderBy(desc(agentRun.id)).limit(1);

  return last && !FINISHED_OUTCOMES.includes(last.outcome) ? last : null;
}

async function continuation(db: PowerLoomDb, conversations: ConversationStore, info: AgentRunInfo, previous: RunRow): Promise<Omit<ConversationPlan, "id">> {
  if (await isStartOverChosen(db, previous.itemId)) {
    return { continues: null, skipped: "Start over was chosen" };
  }

  const kept = await runWithConversation(db, conversations, previous);

  if (!kept) {
    return { continues: null, skipped: `run ${previous.id} kept no conversation` };
  }

  const mismatch = mismatchReason(info, kept);

  return mismatch ? { continues: null, skipped: mismatch } : { continues: kept, skipped: null };
}

// A run that failed before its agent started (e.g. a repo didn't open) wrote no conversation; the run it was to
// continue still holds the work, so the walk goes back along continues_run_id.
async function runWithConversation(db: PowerLoomDb, conversations: ConversationStore, run: RunRow): Promise<PreviousRun | null> {
  let candidate: RunRow | null = run;
  let hops = 0;

  while (candidate && hops < MAX_HOPS && !(await isKept(conversations, candidate))) {
    candidate = await continuedRun(db, candidate);
    hops += 1;
  }

  return candidate && hasConversation(candidate) && hops < MAX_HOPS ? candidate : null;
}

async function isKept(conversations: ConversationStore, run: RunRow): Promise<boolean> {
  return hasConversation(run) && (await conversations.exists(run.conversationId));
}

async function continuedRun(db: PowerLoomDb, run: RunRow): Promise<RunRow | null> {
  if (run.continuesRunId === null) {
    return null;
  }

  const [earlier] = await db.select().from(agentRun).where(eq(agentRun.id, run.continuesRunId));

  return earlier ?? null;
}

async function isStartOverChosen(db: PowerLoomDb, itemId: string | null): Promise<boolean> {
  if (!itemId) {
    return false;
  }

  const [task] = await db.select({ startOver: localItem.startOver }).from(localItem).where(eq(localItem.id, itemId));

  return task?.startOver ?? false;
}

function mismatchReason(info: AgentRunInfo, previous: RunRow): string | null {
  if (previous.stage !== info.stage) {
    return `run ${previous.id} was a ${previous.stage} run`;
  }

  if (previous.promptVersion !== info.promptVersion) {
    return `the prompt changed (${previous.promptVersion} → ${info.promptVersion})`;
  }

  if (previous.model !== info.model.model) {
    return `the model changed (${previous.model} → ${info.model.model})`;
  }

  return isTooOld(previous) ? `run ${previous.id} ended more than ${MAX_AGE_DAYS} days ago` : null;
}

function isTooOld(previous: RunRow): boolean {
  const endedAt = previous.endedAt ?? previous.startedAt;

  return Date.now() - endedAt.getTime() > MAX_AGE_DAYS * DAY_MS;
}

function hasConversation(run: RunRow): run is PreviousRun {
  return run.conversationId !== null;
}
