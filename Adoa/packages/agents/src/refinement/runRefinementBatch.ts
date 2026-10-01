import { isAgentsPaused, readAdoSettings, readAgentSettings, saveAgentSettings, setPbiStatus, type AgentSettings } from "@adoa/core";
import type { workItem } from "@adoa/db";
import { createDocTools, createSkillTools, loadSkills, skillsPromptSection, type SkillInfo } from "@agenttools/runtime";
import { BudgetGuard } from "@agenttools/usage";
import type { LoadedPrompt } from "../models/LoadedPrompt";
import { loadPrompt } from "../prompts";
import { runAgent } from "../runAgent";
import { claimPbi } from "./claimPbi";
import { commitRefinement } from "./commitRefinement";
import type { RefinementBatchDeps } from "./models/RefinementBatchDeps";
import type { RefinementDraft } from "./models/RefinementDraft";
import { buildPbiMessage } from "./pbiMessage";
import { createRefinementTools } from "./refinementTools";
import { selectCandidates } from "./selectCandidates";

type WorkItemRow = typeof workItem.$inferSelect;
type Step = "next" | "stop";

const AGENT = "refinement";
const RATE_LIMIT_PAUSE_MS = 60 * 60 * 1000;

interface BatchContext {
  deps: RefinementBatchDeps;
  settings: AgentSettings;
  prompt: LoadedPrompt;
  skills: SkillInfo[];
  dailyGuard: BudgetGuard;
}

// Scheduled job: refines up to `batchSize` PBIs, one agent run each, stopping early on budgets or rate limits.
export async function runRefinementBatch(deps: RefinementBatchDeps): Promise<string> {
  const settings = await readAgentSettings(deps.db);

  if (!settings.refinement.enabled || isAgentsPaused(settings)) {
    return "skipped: refinement disabled or agents paused";
  }

  const candidates = await selectCandidates(deps.db, settings.refinement);
  const context = await createContext(deps, settings);
  let index = 0;
  let step: Step = "next";

  while (index < candidates.length && step === "next") {
    step = await refineOne(context, candidates[index]);
    index += 1;
  }

  return `processed ${index} of ${candidates.length} candidates`;
}

async function createContext(deps: RefinementBatchDeps, settings: AgentSettings): Promise<BatchContext> {
  const team = (await readAdoSettings(deps.db))?.team ?? "";
  const stage = settings.refinement;
  const dailyGuard = new BudgetGuard({
    perRunUsd: null,
    daily: [{ match: { agent: AGENT }, limitUsd: stage.dailyBudgetUsd }, { match: {}, limitUsd: settings.dailyBudgetUsd }],
  }, deps.usageStore);

  return {
    deps,
    settings,
    prompt: await loadPrompt(AGENT, { team }),
    skills: await loadSkills(deps.skillFolders, stage.skills),
    dailyGuard,
  };
}

async function refineOne(context: BatchContext, row: WorkItemRow): Promise<Step> {
  const decision = await context.dailyGuard.canStart({ agent: AGENT });

  if (!decision.allowed) {
    console.log(`refinement: ${decision.reason}`);

    return "stop";
  }

  const isClaimed = await claimPbi(context.deps.db, row.adoId);

  return isClaimed ? runClaimed(context, row) : "next";
}

async function runClaimed(context: BatchContext, row: WorkItemRow): Promise<Step> {
  const { deps, settings, prompt, skills } = context;
  const stage = settings.refinement;
  const pbiMessage = await buildPbiMessage(deps.vaultRoot, row);
  const draft: RefinementDraft = { refinement: null, researchTasks: [], questions: [] };
  const result = await runAgent(deps, {
    stage: "refinement",
    pbiId: row.adoId,
    labels: { agent: AGENT, item: `PBI-${row.adoId}` },
    model: { provider: stage.provider, model: stage.model },
    promptVersion: prompt.version,
    systemPrompt: [prompt.text, skillsPromptSection(skills)].filter(Boolean).join("\n\n"),
    firstMessage: pbiMessage,
    tools: [...createDocTools({ root: deps.docsRoot, exclude: deps.docsExclude }), ...createSkillTools(skills), ...createRefinementTools(deps.db, draft, pbiMessage)],
    limits: { maxTurns: stage.maxTurns, timeoutMs: stage.timeoutMinutes * 60_000 },
    perRunBudgetUsd: stage.perRunBudgetUsd,
    hasRequiredOutput: () => draft.refinement !== null,
  });

  console.log(`refinement PBI-${row.adoId}: ${result.outcome}, $${result.costUsd.toFixed(4)}${result.error ? ` (${result.error})` : ""}`);

  if (result.outcome === "success") {
    await commitRefinement(deps.db, row.adoId, result.runId, { ...draft, refinement: draft.refinement! });
    await deps.enqueueRender(row.adoId);

    return "next";
  }

  await setPbiStatus(deps.db, row.adoId, "refining", "ready-for-refinement", "agent:refinement", result.runId);

  return result.outcome === "rate-limited" ? pauseForRateLimit(context, result.rateLimitResetsAt) : "next";
}

// Max usage limit hit: pause every agent until the limit resets (or an hour when the reset time is unknown).
async function pauseForRateLimit(context: BatchContext, resetsAt: Date | null): Promise<Step> {
  const until = resetsAt ?? new Date(Date.now() + RATE_LIMIT_PAUSE_MS);
  const settings = await readAgentSettings(context.deps.db);

  await saveAgentSettings(context.deps.db, { ...settings, pausedUntil: until.toISOString() });
  console.log(`refinement: rate limited, agents paused until ${until.toISOString()}`);

  return "stop";
}
