import type { AgentDefinition, AgentsGlobal } from "@agenttools/config";
import { workItem } from "@powerloom/db";
import { createDocTools, createSkillTools, listSkills, loadSkills, skillsPromptSection, type ToolDefinition } from "@agenttools/runtime";
import { eq } from "drizzle-orm";
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

// The agent's configured skills (a missing one fails the run) plus the PBI's skills (a missing one is skipped), configured first.
// A task without a PBI gets only the configured ones.
export async function loadStageSkills(deps: AgentDeps, agent: AgentDefinition, pbiId: number | null): Promise<StageSkills> {
  const [pbi] = pbiId === null ? [] : await deps.db.select({ skills: workItem.skills }).from(workItem).where(eq(workItem.adoId, pbiId));
  const available = (await listSkills(deps.skillFolders)).skills.map((skill) => skill.name);
  const pbiNames = (pbi?.skills ?? []).map((skill) => skill.name).filter((name) => !agent.skills.includes(name));
  const fromPbi = pbiNames.filter((name) => available.includes(name));
  const skills = await loadSkills(deps.skillFolders, [...agent.skills, ...fromPbi]);

  return {
    skills,
    tools: createSkillTools(skills),
    promptSection: skillsPromptSection(skills),
    configured: agent.skills,
    fromPbi,
    skipped: pbiNames.filter((name) => !available.includes(name)),
  };
}

// What the executors put in their `context` phase, so the trace shows where each skill came from.
export function skillsTrace(skills: StageSkills): Record<string, string[]> {
  return { configured: skills.configured, fromPbi: skills.fromPbi, skippedPbiSkills: skills.skipped };
}

// Provider limit hit: pause every agent until it resets (or an hour when the reset time is unknown).
export async function pauseForRateLimit(deps: AgentDeps, resetsAt: Date | null): Promise<void> {
  const until = resetsAt ?? new Date(Date.now() + RATE_LIMIT_PAUSE_MS);
  const global = await deps.config.getGlobal();

  await deps.config.saveGlobal({ ...global, pausedUntil: until.toISOString() });
  console.log(`agents paused until ${until.toISOString()} (rate limit)`);
}

// The docs vault tools every agent gets; what it reads and searches goes to the vault's usage log (user decision 2026-10-02).
// Another vault's root (a tech-writer actualize task) gets the same tools without the docs vault's log and exclusions.
export function createAgentDocTools(deps: AgentDeps, agentId: string, runId: number, root = deps.docsRoot): ToolDefinition<any>[] {
  const isDocsVault = root === deps.docsRoot;
  const usageLog = isDocsVault ? deps.docUsageLog : null;
  const onUse = usageLog ? (paths: string[], kind: "read" | "search") => usageLog.record(paths, kind, agentId, runId) : undefined;

  return createDocTools({ root, exclude: isDocsVault ? deps.docsExclude : [], onUse });
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

// Confluence pages the agent read successfully in this run (read_confluence_page calls whose result wasn't an error).
export async function confluencePagesReadInRun(deps: AgentDeps, runId: number): Promise<string[]> {
  const events = await deps.usageStore.trace(String(runId));
  const failed = new Set(events.filter((event) => event.type === "tool_result" && event.payload.isError === true).map((event) => String(event.payload.callId)));
  const urls = events
    .filter((event) => event.type === "tool_call" && event.payload.name === "read_confluence_page" && !failed.has(String(event.payload.callId)))
    .map((event) => String((event.payload.input as { url?: string } | undefined)?.url ?? ""))
    .filter(Boolean);

  return [...new Set(urls)];
}

export function numberOption(agent: AgentDefinition, name: string, fallback: number): number {
  const value = agent.options[name];

  return typeof value === "number" ? value : fallback;
}
