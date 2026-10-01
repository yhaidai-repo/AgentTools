import type { AgentDefinition, AgentsGlobal } from "@agenttools/config";
import { createSkillTools, loadSkills, skillsPromptSection } from "@agenttools/runtime";
import { BudgetGuard } from "@agenttools/usage";
import type { AgentDeps } from "./models/AgentDeps";
import type { StageSkills } from "./models/StageSkills";

const RATE_LIMIT_PAUSE_MS = 60 * 60 * 1000;

// Pieces every agent shares: daily budgets, skills, rate-limit pause, docs read.
export function dailyGuard(deps: AgentDeps, agent: AgentDefinition, global: AgentsGlobal): BudgetGuard {
  return new BudgetGuard({
    perRunUsd: null,
    daily: [{ match: { agent: agent.id }, limitUsd: agent.budgets.dailyUsd }, { match: {}, limitUsd: global.dailyBudgetUsd }],
  }, deps.usageStore);
}

export async function loadStageSkills(deps: AgentDeps, agent: AgentDefinition): Promise<StageSkills> {
  const skills = await loadSkills(deps.skillFolders, agent.skills);

  return { skills, tools: createSkillTools(skills), promptSection: skillsPromptSection(skills) };
}

// Provider limit hit: pause every agent until it resets (or an hour when the reset time is unknown).
export async function pauseForRateLimit(deps: AgentDeps, resetsAt: Date | null): Promise<void> {
  const until = resetsAt ?? new Date(Date.now() + RATE_LIMIT_PAUSE_MS);
  const global = await deps.config.getGlobal();

  await deps.config.saveGlobal({ ...global, pausedUntil: until.toISOString() });
  console.log(`agents paused until ${until.toISOString()} (rate limit)`);
}

// Every doc a run opened with read_doc, from its trace: the automatic part of the handoff to the next stage.
export async function docsReadInRun(deps: AgentDeps, runId: number): Promise<string[]> {
  const events = await deps.usageStore.trace(String(runId));
  const paths = events
    .filter((event) => event.type === "tool_call" && event.payload.name === "read_doc")
    .map((event) => String((event.payload.input as { path?: string } | undefined)?.path ?? ""))
    .filter(Boolean);

  return [...new Set(paths)];
}

export function numberOption(agent: AgentDefinition, name: string, fallback: number): number {
  const value = agent.options[name];

  return typeof value === "number" ? value : fallback;
}
