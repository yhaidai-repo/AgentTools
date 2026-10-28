import { handoffsOfRun, setItemStatus, type RunHandoff } from "@powerloom/core";
import { localItem, type PowerLoomDb } from "@powerloom/db";
import { and, eq, inArray, ne } from "drizzle-orm";
import type { AgentRunResult } from "../models/AgentRunResult";
import type { ResultDraft } from "../result/models/ResultDraft";
import { blockTask } from "../tasks/endTask";
import { dependenciesOf, recordWaiting } from "../tasks/waiting";
import type { WriterSettlement } from "../toolset/models/WriterSettlement";

type ItemRow = typeof localItem.$inferSelect;

const ACTOR = "agent-runner";
const OPEN_STATUSES = ["open", "in-progress", "blocked", "draft"] as const;

export interface SettlementInput {
  outcome: AgentRunResult["outcome"];
  result: ResultDraft | null;
  /** What the run handed off (its hand_off calls and its writers' hand-offs), in order. */
  handoffs: RunHandoff[];
  /** The result's waiting_for that exist and aren't closed. */
  openWaitingFor: string[];
  writers: WriterSettlement[];
}

/** done and budget leave the task to endTask (done; blocked with the budget's reason). */
export type Settlement =
  | { kind: "done" }
  | { kind: "budget"; dependsOn: string[] }
  | { kind: "wait"; ids: string[]; reason: string | null }
  | { kind: "block"; reason: string };

// The one decision how a committed run ends its task (user decisions 2026-10-25, 2026-10-28). A budget stop stays
// blocked whatever it handed off (what it asked is kept for the Re-run). A writer's own blockers (a test's blocking
// items) hold the task whatever write_result says. A hand-off settles the task by its intent: one that hands the work on
// (continue, review, return) ends it done when no writer misses its output, even when it also asked something (the
// receiver waits for that); one that only asks makes it wait for the answers, then run again. Complete is done only with
// every output the task promised. Anything else waits for what it named, or is blocked for a person: nothing would run
// it again.
export function decideSettlement(input: SettlementInput): Settlement {
  const waits = input.writers.flatMap((writer) => (writer.kind === "waits" ? [writer] : []));
  const missing = input.writers.flatMap((writer) => (writer.kind === "missing" ? [writer.output] : []));
  const asked = input.handoffs.filter((handoff) => handoff.intent === "ask").map((handoff) => handoff.toItemId);
  const handedOn = input.handoffs.some((handoff) => handoff.intent !== "ask");
  const ownWaits = waits.flatMap((writer) => writer.ids);
  const waitFor = unique([...(waits.length > 0 ? ownWaits : asked), ...input.openWaitingFor]);

  if (input.outcome === "budget-exceeded") {
    return { kind: "budget", dependsOn: waitFor };
  }

  if (waits.length > 0) {
    return { kind: "wait", ids: waitFor, reason: waits.map((writer) => writer.reason).join("; ") };
  }

  if (handedOn && missing.length === 0) {
    return { kind: "done" };
  }

  if (asked.length > 0) {
    return { kind: "wait", ids: waitFor, reason: "Waiting for what it asked" };
  }

  if (input.result?.status === "complete") {
    return missing.length > 0 ? { kind: "block", reason: `The run reported complete without ${missing.join(" and ")}. Check its result, then Re-run.` } : { kind: "done" };
  }

  if (waitFor.length > 0) {
    return { kind: "wait", ids: waitFor, reason: null };
  }

  return { kind: "block", reason: unfinishedReason(input.result) };
}

export function unfinishedReason(result: ResultDraft | null): string {
  if (!result) {
    return "The run ended without a result. Re-run it.";
  }

  const summary = result.body.split("\n").find((line) => line.trim().length > 0)?.trim().replace(/^#+\s*/, "") ?? "";

  return `The run ended ${result.status} with nothing to wait for: ${summary.slice(0, 300)}. Settle what it names, then Re-run.`;
}

// Applies the decision to a task still in progress (writers never change its status). Done and budget leave it to
// endTask; a budget stop keeps what it waits for in data.dependsOn, so the Re-run waits for them too.
export async function settleTask(db: PowerLoomDb, task: ItemRow, runId: number, input: Omit<SettlementInput, "openWaitingFor" | "handoffs">): Promise<Settlement> {
  const [current] = await db.select().from(localItem).where(eq(localItem.id, task.id));
  const handoffs = await handoffsOfRun(db, runId);
  const settlement = decideSettlement({ ...input, handoffs, openWaitingFor: await openItems(db, input.result?.waitingFor ?? [], task.id) });

  if (current?.status !== "in-progress") {
    return settlement;
  }

  if (settlement.kind === "budget" && settlement.dependsOn.length > 0) {
    const dependsOn = unique([...dependenciesOf(current), ...settlement.dependsOn]);

    await db.update(localItem).set({ data: { ...(current.data as object), dependsOn } }).where(eq(localItem.id, task.id));
  }

  if (settlement.kind === "wait") {
    await setItemStatus(db, task.id, "in-progress", "open", ACTOR);
    await recordWaiting(db, current, runId, settlement.ids, settlement.reason);
  }

  if (settlement.kind === "block") {
    await blockTask(db, task, settlement.reason, runId);
  }

  return settlement;
}

// The named items that exist and aren't closed; the dispatcher would start the task at once for any other.
async function openItems(db: PowerLoomDb, ids: string[], taskId: string): Promise<string[]> {
  if (ids.length === 0) {
    return [];
  }

  const rows = await db.select({ id: localItem.id }).from(localItem)
    .where(and(inArray(localItem.id, ids), ne(localItem.id, taskId), inArray(localItem.status, OPEN_STATUSES)));

  return rows.map((row) => row.id);
}

function unique(ids: string[]): string[] {
  return [...new Set(ids)];
}
