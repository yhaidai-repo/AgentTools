import type { RunLimits } from "@agenttools/runtime";
import type { UsageStore } from "@agenttools/usage";
import type { PreviousLimits } from "./models/PreviousLimits";
import type { PreviousRun } from "./models/PreviousRun";
import type { ReplayReport } from "./models/ReplayReport";

const CLOCK_SLACK_MS = 60_000;

const STOPS: Record<string, string> = {
  "budget-exceeded": "it reached its budget",
  "max-turns": "it used all its turns",
  timeout: "it ran out of time",
  aborted: "it was stopped from outside",
  "rate-limited": "the provider's rate limit stopped it (the limit has reset since)",
  failed: "it failed",
};

// The limits the continued run had (its `agent` phase) and what it spent (its usage record).
export async function loadPreviousLimits(usageStore: UsageStore, previous: PreviousRun): Promise<PreviousLimits> {
  const trace = await usageStore.trace(String(previous.id));
  const agentPhase = trace.find((entry) => entry.type === "phase" && entry.payload.name === "agent")?.payload ?? {};
  const from = new Date(previous.startedAt.getTime() - CLOCK_SLACK_MS);
  const [record] = await usageStore.records({ from, match: { run: String(previous.id) } }, 1);

  return {
    maxTurns: numberOrNull(agentPhase.turnsLimit),
    timeoutMs: numberOrNull(agentPhase.timeoutMs),
    budgetUsd: numberOrNull(agentPhase.budgetUsd),
    spentUsd: record?.costUsd ?? null,
  };
}

// The first message of a continued run, in place of the task's: why the last run stopped, this run's limits, what was
// restored, and to carry on rather than start over.
export function continuationMessage(previous: PreviousRun, before: PreviousLimits, limits: RunLimits, budgetUsd: number, replay: ReplayReport): string {
  return [
    "<continuation>",
    `Your previous run (RUN-${previous.id}) stopped before it finished: ${stopReason(previous, before)}.`,
    "If your last tool call has no result, it did not finish.",
    `This run continues the same conversation with fresh limits: ${limitsText(limits, budgetUsd, before)}.`,
    restoredText(replay),
    failedReplaysText(replay),
    "Continue where you stopped: don't redo finished work or re-read what you already have, and end with your required output.",
    "</continuation>",
  ].filter(Boolean).join("\n");
}

function stopReason(previous: PreviousRun, before: PreviousLimits): string {
  const stop = STOPS[previous.outcome] ?? `it ended ${previous.outcome}`;
  const spent = previous.outcome === "budget-exceeded" && before.spentUsd !== null ? ` (${usd(before.spentUsd)} spent)` : "";
  const error = previous.error && previous.error !== previous.outcome ? `: ${previous.error}` : "";

  return `${stop}${spent}${error}`;
}

function limitsText(limits: RunLimits, budgetUsd: number, before: PreviousLimits): string {
  const minutes = Math.round(limits.timeoutMs / 60_000);
  const raised = before.budgetUsd !== null && before.budgetUsd !== budgetUsd ? ` (the last run had ${usd(before.budgetUsd)})` : "";

  return `up to ${limits.maxTurns} turns, ${minutes} minutes and ${usd(budgetUsd)}${raised}`;
}

function restoredText(replay: ReplayReport): string {
  const counts = Object.entries(replay.replayed).map(([tool, count]) => `${tool} ×${count}`);

  return counts.length > 0 ? `Your saved output was restored by making your earlier calls again: ${counts.join(", ")}.` : "";
}

function failedReplaysText(replay: ReplayReport): string {
  if (replay.failed.length === 0) {
    return "";
  }

  return `These earlier calls could not be restored; make them again if they still apply:\n${replay.failed.map((failure) => `- ${failure}`).join("\n")}`;
}

function usd(value: number): string {
  return `$${value.toFixed(2)}`;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}
