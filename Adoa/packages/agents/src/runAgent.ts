import { agentRun } from "@adoa/db";
import { BudgetGuard, TraceRecorder, UsageTracker, toOutcome } from "@agenttools/usage";
import { eq } from "drizzle-orm";
import type { AgentDeps } from "./models/AgentDeps";
import type { AgentRunResult } from "./models/AgentRunResult";
import type { AgentRunSpec } from "./models/AgentRunSpec";
import { RunObserver } from "./RunObserver";

// One agent run, provider-independent: adoa run row + runtime events + usage, trace and per-run budget.
export async function runAgent(deps: AgentDeps, spec: AgentRunSpec): Promise<AgentRunResult> {
  const runId = await insertRun(deps, spec);
  const tracker = new UsageTracker(String(runId), { ...spec.labels, run: String(runId) }, deps.prices);
  const trace = new TraceRecorder(deps.usageStore);
  const guard = new BudgetGuard({ perRunUsd: spec.perRunBudgetUsd, daily: [] }, deps.usageStore);
  const observer = new RunObserver(tracker, trace, guard);

  for await (const event of deps.runtime.run(toRequest(spec, runId, observer.abort.signal))) {
    await observer.observe(event);
  }

  await trace.flush();

  return finishRun(deps, runId, tracker, observer, spec.hasRequiredOutput);
}

async function insertRun(deps: AgentDeps, spec: AgentRunSpec): Promise<number> {
  const [row] = await deps.db
    .insert(agentRun)
    .values({ stage: spec.stage, pbiId: spec.pbiId, promptVersion: spec.promptVersion, model: spec.model.model, input: spec.firstMessage })
    .returning({ id: agentRun.id });

  return row.id;
}

function toRequest(spec: AgentRunSpec, runId: number, signal: AbortSignal) {
  return {
    runId: String(runId),
    model: spec.model,
    systemPrompt: spec.systemPrompt,
    firstMessage: spec.firstMessage,
    tools: spec.tools,
    limits: spec.limits,
    signal,
  };
}

const MISSING_OUTPUT = "Run ended without its required output";

async function finishRun(deps: AgentDeps, runId: number, tracker: UsageTracker, observer: RunObserver, hasRequiredOutput: () => boolean): Promise<AgentRunResult> {
  const result = observer.resultEvent;
  const reported = toOutcome(result?.reason ?? "failed", observer.isBudgetAbort);
  const isMissingOutput = reported === "success" && !hasRequiredOutput();
  const outcome = isMissingOutput ? "failed" : reported;
  const error = errorText(outcome, isMissingOutput, result?.message ?? null);
  const record = tracker.finish({ outcome, turns: result?.turns ?? 0, error, providerCostUsd: result?.providerCostUsd ?? null });

  await deps.usageStore.saveRecord(record);
  await deps.db.update(agentRun).set({ outcome, error, endedAt: new Date() }).where(eq(agentRun.id, runId));

  return { runId, outcome, error, costUsd: record.costUsd, rateLimitResetsAt: observer.rateLimitResetsAt };
}

function errorText(outcome: string, isMissingOutput: boolean, providerMessage: string | null): string | null {
  if (outcome === "success") {
    return null;
  }

  return isMissingOutput ? MISSING_OUTPUT : (providerMessage ?? outcome);
}
