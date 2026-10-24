import { agentRun } from "@powerloom/db";
import type { AgentRuntime, ConversationStore } from "@agenttools/runtime";
import { BudgetGuard, TraceRecorder, UsageTracker, toOutcome, type RunOutcome } from "@agenttools/usage";
import { eq } from "drizzle-orm";
import type { AgentDeps } from "./models/AgentDeps";
import type { AgentRunInfo } from "./models/AgentRunInfo";
import type { AgentRunInput } from "./models/AgentRunInput";
import type { AgentRunResult } from "./models/AgentRunResult";
import { withPbiContext } from "./pbiContext/withPbiContext";
import { continuationMessage, loadPreviousRunFacts } from "./resume/continuationMessage";
import type { ConversationPlan } from "./resume/models/ConversationPlan";
import type { PreviousRun } from "./resume/models/PreviousRun";
import type { RunOpening } from "./resume/models/RunOpening";
import { clearStartOver, planConversation } from "./resume/planConversation";
import { replayDraft } from "./resume/replayDraft";
import { RunObserver } from "./RunObserver";
import { stackOwner } from "./devHubTools";
import { ToolCallLogger } from "./ToolCallLogger";

const MISSING_OUTPUT = "Run ended without its required output";
const LIVE_TRACE_BATCH = 1;

type Commit = () => Promise<void>;

// One agent run from its first step: the run row exists before preparation, every phase and agent event
// is traced live, and any failure (preparation, agent, commit) ends the run as `failed` with the reason.
// A task run after one that didn't succeed continues that run's conversation (planConversation).
export class AgentRunSession {
  private seq = 0;
  private currentPhase = "start";
  private observer: RunObserver | null = null;
  private tracker: UsageTracker;
  private trace: TraceRecorder;

  private constructor(
    private readonly deps: AgentDeps,
    readonly runId: number,
    info: AgentRunInfo,
    private readonly plan: ConversationPlan,
  ) {
    this.tracker = new UsageTracker(String(runId), { ...info.labels, run: String(runId) }, deps.prices);
    this.trace = new TraceRecorder(deps.usageStore, undefined, LIVE_TRACE_BATCH);
  }

  static async begin(deps: AgentDeps, info: AgentRunInfo): Promise<AgentRunSession> {
    const plan = await planConversation(deps, info);
    const [row] = await deps.db
      .insert(agentRun)
      .values({ stage: info.stage, pbiId: info.pbiId, itemId: info.itemId, promptVersion: info.promptVersion, model: info.model.model, conversationId: plan.id, continuesRunId: plan.continues?.id ?? null })
      .returning({ id: agentRun.id });
    const session = new AgentRunSession(deps, row.id, info, plan);

    await clearStartOver(deps.db, info.itemId);
    await session.phase("start", { stage: info.stage, pbi: info.pbiId, item: info.itemId ?? null, model: `${info.model.provider}/${info.model.model}`, continues: plan.continues?.id ?? null, freshBecause: plan.skipped });

    return session;
  }

  /** Records a preparation step in the trace (shown live on the run page). */
  async phase(name: string, detail: Record<string, unknown> = {}): Promise<void> {
    this.currentPhase = name;
    await this.record({ type: "phase", name, ...detail });
  }

  /** Prepares and runs the agent; a failure anywhere returns a `failed` result instead of throwing. */
  async execute(info: AgentRunInfo, prepare: () => Promise<AgentRunInput>): Promise<AgentRunResult> {
    try {
      const input = await withPbiContext(this.deps, info.pbiId, await prepare());

      return await this.runAgent(info, input);
    } catch (error) {
      await this.recordError(error);

      return this.result("failed", `${this.currentPhase}: ${errorMessage(error)}`);
    }
  }

  /** Commits a successful run's output, then stores the final outcome and usage. A failing commit fails the run.
   *  `keepOnBudgetStop`: a run stopped by its budget still commits what it saved (a partial result); the outcome stays. */
  async finish(result: AgentRunResult, commit: Commit | null, keepOnBudgetStop = false): Promise<AgentRunResult> {
    const final = await this.commitIfSuccess(result, commit, keepOnBudgetStop);
    const record = this.tracker.finish({ outcome: final.outcome, turns: this.observer?.resultEvent?.turns ?? 0, error: final.error, providerCostUsd: this.providerCostUsd });

    await this.trace.flush();
    await this.deps.usageStore.saveRecord(record);
    await this.deps.db.update(agentRun).set({ outcome: final.outcome, error: final.error, endedAt: new Date() }).where(eq(agentRun.id, this.runId));

    return { ...final, costUsd: record.costUsd };
  }

  /** What the run has cost so far, from the usage events seen; the budget notes show it to the agent. */
  get spentUsd(): number {
    return this.tracker.costUsd;
  }

  get providerCostUsd(): number | null {
    return this.observer?.resultEvent?.providerCostUsd ?? null;
  }

  private async runAgent(info: AgentRunInfo, input: AgentRunInput): Promise<AgentRunResult> {
    const guard = new BudgetGuard({ perRunUsd: input.perRunBudgetUsd, daily: [] }, this.deps.usageStore);
    const tools = new ToolCallLogger(this.deps.accessLog, { vault: this.deps.docsVaultName, agentId: String(info.labels.agent ?? info.stage), runId: this.runId, owner: stackOwner(this.runId), taskId: info.itemId ?? null, pbiId: info.pbiId });
    const observer = new RunObserver(this.tracker, guard, (event) => this.record(event), tools);

    const runtime = this.deps.runtimes.get(info.model.provider);
    const opening = await this.opening(runtime.conversations, input);

    this.observer = observer;
    await this.deps.db.update(agentRun).set({ input: opening.firstMessage }).where(eq(agentRun.id, this.runId));
    await this.phase("agent", { turnsLimit: input.limits.maxTurns, timeoutMs: input.limits.timeoutMs, budgetUsd: input.perRunBudgetUsd, conversation: opening.conversation ?? null });
    await this.sampleSubscription(runtime);

    for await (const event of runtime.run({ runId: String(this.runId), model: info.model, ...input, ...opening, signal: observer.abort.signal })) {
      await observer.observe(event);
      input.observe?.(event);
    }

    await tools.flush();
    await this.sampleSubscription(runtime);

    return this.agentResult(observer, input);
  }

  // A continued run first rebuilds its draft from the earlier conversation, then opens with the continuation note. If the
  // earlier conversation can't be read, the run starts fresh after all and no longer counts as continuing it.
  private async opening(conversations: ConversationStore | null, input: AgentRunInput): Promise<RunOpening> {
    const fresh = { firstMessage: input.firstMessage, conversation: this.plan.id ? { id: this.plan.id, continues: null } : undefined };
    const previous = this.plan.continues;

    if (!previous || !conversations || !this.plan.id) {
      return fresh;
    }

    try {
      return await this.continuation(conversations, input, previous, this.plan.id);
    } catch (error) {
      await this.phase("resume", { from: previous.id, freshBecause: errorMessage(error) });
      await this.deps.db.update(agentRun).set({ continuesRunId: null }).where(eq(agentRun.id, this.runId));

      return fresh;
    }
  }

  private async continuation(conversations: ConversationStore, input: AgentRunInput, previous: PreviousRun, id: string): Promise<RunOpening> {
    const before = await loadPreviousRunFacts(this.deps.usageStore, previous);
    const replay = await replayDraft(conversations, previous.conversationId, input.tools, { observe: input.observe, withDrafts: !before.committed });

    await this.phase("resume", { from: previous.id, conversation: previous.conversationId, draftSaved: before.committed, replayed: replay.replayed, restoredReads: replay.restored, failed: replay.failed });

    return {
      firstMessage: continuationMessage(previous, before, input.limits, input.perRunBudgetUsd, replay),
      conversation: { id, continues: previous.conversationId },
    };
  }

  private agentResult(observer: RunObserver, input: AgentRunInput): AgentRunResult {
    const result = observer.resultEvent;
    const reported = toOutcome(result?.reason ?? "failed", observer.isBudgetAbort);
    const isMissingOutput = reported === "success" && !input.hasRequiredOutput();

    if (isMissingOutput) {
      return this.result("failed", MISSING_OUTPUT, observer.rateLimitResetsAt);
    }

    return this.result(reported, reported === "success" ? null : (result?.message ?? reported), observer.rateLimitResetsAt);
  }

  // A run's share of the subscription: free for runtimes that report it during the run, otherwise asked before and
  // after. A failed reading doesn't fail the run; the trace says why.
  private async sampleSubscription(runtime: AgentRuntime): Promise<void> {
    if (runtime.reportsSubscriptionInRuns) {
      return;
    }

    try {
      this.tracker.addSubscription((await runtime.subscriptionUsage()).windows);
    } catch (error) {
      await this.phase("subscription", { error: errorMessage(error) });
    }
  }

  private async commitIfSuccess(result: AgentRunResult, commit: Commit | null, keepOnBudgetStop: boolean): Promise<AgentRunResult> {
    const isKept = result.outcome === "success" || (keepOnBudgetStop && result.outcome === "budget-exceeded");

    if (!isKept || !commit) {
      return result;
    }

    try {
      await this.phase("commit");
      await commit();

      return result;
    } catch (error) {
      await this.recordError(error);

      return { ...result, outcome: "failed", error: `commit: ${errorMessage(error)}` };
    }
  }

  private async recordError(error: unknown): Promise<void> {
    const stack = error instanceof Error ? error.stack ?? null : null;

    console.error(`run ${this.runId} failed in ${this.currentPhase}:`, error);
    await this.record({ type: "error", phase: this.currentPhase, message: errorMessage(error), stack });
  }

  // The session numbers every trace entry, so preparation phases and agent events share one sequence.
  private async record(entry: { type: string; [field: string]: unknown }): Promise<void> {
    this.seq += 1;
    await this.trace.record({ ...entry, runId: String(this.runId), seq: this.seq, at: new Date() });
  }

  private result(outcome: RunOutcome, error: string | null, rateLimitResetsAt: Date | null = null): AgentRunResult {
    return { runId: this.runId, outcome, error, costUsd: this.tracker.costUsd, rateLimitResetsAt };
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
