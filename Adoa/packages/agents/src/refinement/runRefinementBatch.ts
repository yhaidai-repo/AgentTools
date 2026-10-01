import { readAdoSettings, setPbiStatus } from "@adoa/core";
import type { workItem } from "@adoa/db";
import type { AgentDefinition } from "@agenttools/config";
import { createDocTools } from "@agenttools/runtime";
import type { BudgetGuard } from "@agenttools/usage";
import { AgentRunSession } from "../AgentRunSession";
import { safeStep, throwIfErrors, type Step } from "../batchSteps";
import type { AgentDeps } from "../models/AgentDeps";
import type { AgentRunInfo } from "../models/AgentRunInfo";
import type { AgentRunInput } from "../models/AgentRunInput";
import type { LoadedPrompt } from "../models/LoadedPrompt";
import type { StageSkills } from "../models/StageSkills";
import { loadPrompt } from "../prompts";
import { dailyGuard, docsReadInRun, loadRunnableStage, loadStageSkills, numberOption, pauseForRateLimit } from "../stage";
import { claimPbi } from "./claimPbi";
import { commitRefinement } from "./commitRefinement";
import type { RefinementDraft } from "./models/RefinementDraft";
import { createAttachmentTool } from "../attachmentTools";
import { buildPbiMessage } from "./pbiMessage";
import { createRefinementTools } from "./refinementTools";
import { selectCandidates } from "./selectCandidates";

type WorkItemRow = typeof workItem.$inferSelect;

const AGENT = "refinement";

interface BatchContext {
  deps: AgentDeps;
  agent: AgentDefinition;
  prompt: LoadedPrompt;
  skills: StageSkills;
  guard: BudgetGuard;
}

// Scheduled job: refines up to `batchSize` PBIs, one agent run each, stopping early on budgets or rate limits.
export async function runRefinementBatch(deps: AgentDeps): Promise<string> {
  const stage = await loadRunnableStage(deps, AGENT);

  if (!stage) {
    return "skipped: refinement disabled or agents paused";
  }

  const { agent, global } = stage;
  const candidates = await selectCandidates(deps.db, numberOption(agent, "batchSize", 2), numberOption(agent, "maxFailures", 3));
  const team = (await readAdoSettings(deps.db))?.team ?? "";
  const context: BatchContext = {
    deps,
    agent,
    prompt: await loadPrompt(AGENT, { team }),
    skills: await loadStageSkills(deps, agent),
    guard: dailyGuard(deps, agent, global),
  };
  const errors: string[] = [];
  let index = 0;
  let step: Step = "next";

  while (index < candidates.length && step === "next") {
    const row = candidates[index];

    step = await safeStep(AGENT, `PBI-${row.adoId}`, errors, () => refineOne(context, row));
    index += 1;
  }

  throwIfErrors(AGENT, errors);

  return `processed ${index} of ${candidates.length} candidates`;
}

async function refineOne(context: BatchContext, row: WorkItemRow): Promise<Step> {
  const decision = await context.guard.canStart({ agent: AGENT });

  if (!decision.allowed) {
    console.log(`refinement: ${decision.reason}`);

    return "stop";
  }

  const isClaimed = await claimPbi(context.deps.db, row.adoId);

  return isClaimed ? runClaimed(context, row) : "next";
}

async function runClaimed(context: BatchContext, row: WorkItemRow): Promise<Step> {
  const { deps } = context;
  const info: AgentRunInfo = {
    stage: "refinement",
    pbiId: row.adoId,
    labels: { agent: AGENT, item: `PBI-${row.adoId}` },
    model: context.agent.model,
    promptVersion: context.prompt.version,
  };
  const draft: RefinementDraft = { refinement: null, researchTasks: [], questions: [] };
  const session = await AgentRunSession.begin(deps, info);
  const ran = await session.execute(info, () => prepare(context, session, row, draft));
  const commit = async () => {
    await commitRefinement(deps.db, row.adoId, session.runId, { ...draft, refinement: draft.refinement! }, await docsReadInRun(deps, session.runId));
  };
  const result = await session.finish(ran, commit);

  console.log(`refinement PBI-${row.adoId}: run ${result.runId} ${result.outcome}, $${result.costUsd.toFixed(4)}${result.error ? ` (${result.error})` : ""}`);

  if (result.outcome === "success") {
    await deps.enqueueRender(row.adoId);

    return "next";
  }

  await setPbiStatus(deps.db, row.adoId, "refining", "ready-for-refinement", "agent:refinement", result.runId);

  if (result.outcome !== "rate-limited") {
    return "next";
  }

  await pauseForRateLimit(deps, result.rateLimitResetsAt);

  return "stop";
}

async function prepare(context: BatchContext, session: AgentRunSession, row: WorkItemRow, draft: RefinementDraft): Promise<AgentRunInput> {
  const { deps, agent, prompt, skills } = context;

  await session.phase("context", { pbi: row.adoId, note: row.vaultPath, skills: skills.skills.map((skill) => skill.name) });

  const pbiMessage = await buildPbiMessage(deps.db, deps.vaultRoot, row);

  await session.phase("first-message", { chars: pbiMessage.length });

  return {
    capabilities: agent.capabilities,
    systemPrompt: [prompt.text, skills.promptSection].filter(Boolean).join("\n\n"),
    firstMessage: pbiMessage,
    tools: [...createDocTools({ root: deps.docsRoot, exclude: deps.docsExclude }), ...skills.tools, createAttachmentTool(deps.db, row.adoId), ...createRefinementTools(deps.db, draft, pbiMessage)],
    limits: { maxTurns: agent.limits.maxTurns, timeoutMs: agent.limits.timeoutMinutes * 60_000 },
    perRunBudgetUsd: agent.budgets.perRunUsd,
    hasRequiredOutput: () => draft.refinement !== null,
  };
}
