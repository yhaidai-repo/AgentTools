import type { AgentDefinition, AgentIntegrationSpec, AgentOptionSpec, AgentsGlobal } from "@agenttools/config";
import { CONFLUENCE_INTEGRATION } from "./confluenceTools";

// adoa's agents with the values the user approved; AgentConfig keeps what clients saved and only fills gaps.
export const GLOBAL_DEFAULTS: AgentsGlobal = { paused: false, pausedUntil: null, dailyBudgetUsd: 10 };

// What each option does, shown next to its field in the web UI. Keys are the ones the stage code reads (numberOption).
function batchSizeOption(unit: string): AgentOptionSpec {
  return {
    key: "batchSize",
    label: `${unit} per scheduled run`,
    description: `Most ${unit.toLowerCase()} the dispatcher starts per scheduled run; the rest wait for the next one. Higher = faster throughput, more tokens per hour.`,
    min: 1,
    max: 20,
  };
}

const REFINEMENT_OPTIONS: AgentOptionSpec[] = [
  batchSizeOption("PBIs"),
  {
    key: "maxFailures",
    label: "Failures before skipping a PBI",
    description: "After this many failed runs on one PBI, refinement stops picking it until you prepare it again in the Backlog.",
    min: 1,
    max: 10,
  },
];

const RESEARCH_OPTIONS: AgentOptionSpec[] = [
  batchSizeOption("Tasks"),
  {
    key: "maxFailures",
    label: "Failures before blocking a task",
    description: "After this many failed runs, the research task is set to blocked and no longer picked.",
    min: 1,
    max: 10,
  },
  {
    key: "maxDepth",
    label: "Follow-up depth",
    description: "How deep research may create follow-up research tasks. 1 = no follow-ups; 2 = tasks from refinement may create one level of follow-ups.",
    min: 1,
    max: 5,
  },
  {
    key: "repoRefreshMinutes",
    label: "Repo refresh (minutes)",
    description: "A cached repo is fetched again only when its last fetch is older than this. Lower = fresher code, more git traffic.",
    min: 1,
    max: 1440,
  },
];

const TECH_WRITER_OPTIONS: AgentOptionSpec[] = [
  batchSizeOption("Drafts"),
  {
    key: "maxFailures",
    label: "Failures before blocking a draft's task",
    description: "After this many failed runs, the draft's tech-writer task is set to blocked and no longer picked.",
    min: 1,
    max: 10,
  },
  {
    key: "repoRefreshMinutes",
    label: "Repo refresh (minutes)",
    description: "A cached repo is fetched again only when its last fetch is older than this.",
    min: 1,
    max: 1440,
  },
];

// Outside systems adoa can give an agent tools for; each one is switched on per agent in its Config (user decision 2026-10-02).
const INTEGRATIONS: AgentIntegrationSpec[] = [
  {
    key: CONFLUENCE_INTEGRATION,
    label: "Confluence (read)",
    description: "The agent may read and search Confluence pages during its runs.",
  },
];

export const AGENT_DEFAULTS: AgentDefinition[] = [
  {
    id: "refinement",
    label: "Refinement",
    description: "Makes a prepared PBI ready for research and design: summary, scope, AC gaps, dependencies, repos, research tasks, questions.",
    enabled: true,
    schedule: "0 * * * *",
    model: { provider: "anthropic", model: "claude-sonnet-5" },
    limits: { maxTurns: 40, timeoutMinutes: 10 },
    budgets: { perRunUsd: 1, dailyUsd: 5 },
    capabilities: { webAccess: false, integrations: { [CONFLUENCE_INTEGRATION]: false } },
    skills: ["adoa-refinement-checklist"],
    options: { batchSize: 2, maxFailures: 3 },
    optionSpecs: REFINEMENT_OPTIONS,
    integrationSpecs: INTEGRATIONS,
    next: "design",
    waitFor: ["humanItems", "linkedDocuments", "drafts"],
  },
  {
    id: "research",
    label: "Research",
    description: "Answers one research task from code and docs and writes a research result.",
    enabled: true,
    schedule: "30 * * * *",
    model: { provider: "anthropic", model: "claude-opus-5-5" },
    limits: { maxTurns: 60, timeoutMinutes: 20 },
    budgets: { perRunUsd: 2, dailyUsd: 5 },
    capabilities: { webAccess: false, integrations: { [CONFLUENCE_INTEGRATION]: false } },
    skills: ["adoa-research-checklist"],
    options: { batchSize: 2, maxFailures: 3, maxDepth: 2, repoRefreshMinutes: 30 },
    optionSpecs: RESEARCH_OPTIONS,
    integrationSpecs: INTEGRATIONS,
    next: "design",
    waitFor: ["humanItems", "linkedDocuments", "drafts"],
  },
  {
    id: "tech-writer",
    label: "Tech-writer",
    description: "Moves one vault draft per task into the docs vault: verifies it against the code, merges it into its target, deletes the draft; findings go to the user.",
    enabled: true,
    schedule: "15 */2 * * *",
    model: { provider: "anthropic", model: "claude-sonnet-5" },
    limits: { maxTurns: 40, timeoutMinutes: 15 },
    budgets: { perRunUsd: 1, dailyUsd: 3 },
    capabilities: { webAccess: false, integrations: { [CONFLUENCE_INTEGRATION]: false } },
    skills: ["adoa-tech-writer", "adoa-documentation"],
    options: { batchSize: 3, maxFailures: 3, repoRefreshMinutes: 30 },
    optionSpecs: TECH_WRITER_OPTIONS,
    integrationSpecs: INTEGRATIONS,
    next: null,
    waitFor: [],
  },
];
