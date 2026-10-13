import type { AgentDefinition, AgentIntegrationSpec, AgentOptionSpec, AgentsGlobal } from "@agenttools/config";
import { CONFLUENCE_INTEGRATION } from "./confluenceTools";
import { AZURE_INTEGRATIONS, AZURE_INTEGRATION_SPECS } from "./azureIntegrations";
import { READ_REPOS_INTEGRATION } from "./repos/openRepos";
import { READ_SQL_INTEGRATION } from "./sqlTools";

// PowerLoom's agents with the values the user approved; AgentConfig keeps what clients saved and only fills gaps.
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

// The caps on create_task (chaining v2), shared by every agent that has it.
const TASK_CREATION_OPTIONS: AgentOptionSpec[] = [
  {
    key: "maxDepth",
    label: "Task chain depth",
    description: "How deep a chain of agent-created tasks may go. A task the agent creates gets its own depth + 1; at the limit it hands the gap to the user instead.",
    min: 1,
    max: 6,
  },
  {
    key: "maxTasksPerRun",
    label: "Agent tasks per run",
    description: "Most tasks one run may create for agents; tasks for the user are never capped.",
    min: 1,
    max: 10,
  },
  {
    key: "maxTasksPerPbi",
    label: "Agent tasks per PBI",
    description: "Most tasks agents may create for agents on one PBI over its life. At the cap the agent must ask the user what is still open: the work may be going in circles.",
    min: 1,
    max: 50,
  },
];

const BETTER_RESEARCH_OPTIONS: AgentOptionSpec[] = [
  batchSizeOption("Tasks"),
  {
    key: "maxFailures",
    label: "Failures before blocking a task",
    description: "After this many failed runs, the research task is set to blocked and no longer picked.",
    min: 1,
    max: 10,
  },
  ...TASK_CREATION_OPTIONS,
  {
    key: "repoRefreshMinutes",
    label: "Repo refresh (minutes)",
    description: "A cached repo is fetched again only when its last fetch is older than this. Lower = fresher code, more git traffic.",
    min: 1,
    max: 1440,
  },
];

const DESIGN_OPTIONS: AgentOptionSpec[] = [
  batchSizeOption("PBIs"),
  {
    key: "maxFailures",
    label: "Failures before blocking a design task",
    description: "After this many failed runs, the design task is set to blocked and no longer picked.",
    min: 1,
    max: 10,
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

const CODE_REVIEW_OPTIONS: AgentOptionSpec[] = [
  batchSizeOption("Reviews"),
  {
    key: "maxFailures",
    label: "Failures before blocking a review task",
    description: "After this many failed runs, the review task is set to blocked; Rerun on the review page queues a new one.",
    min: 1,
    max: 10,
  },
  {
    key: "maxDiffLines",
    label: "Changed lines reviewed per run",
    description: "Most changed lines one review covers, largest files first; the rest are listed as not reviewed in the summary. Higher = fuller reviews of big PRs, more tokens.",
    min: 200,
    max: 20000,
  },
  {
    key: "repoRefreshMinutes",
    label: "Repo refresh (minutes)",
    description: "The cached repo's default branch is fetched again only when its last fetch is older than this; the PR's own branches are always fetched.",
    min: 1,
    max: 1440,
  },
];

const VAULT_REVIEW_OPTIONS: AgentOptionSpec[] = [
  batchSizeOption("Review tasks"),
  {
    key: "maxFailures",
    label: "Failures before blocking a review task",
    description: "After this many failed runs, the review task is set to blocked; the vault-review job creates no new one while it waits.",
    min: 1,
    max: 10,
  },
  {
    key: "staleDays",
    label: "Review period (days)",
    description: "One period for both: a note nobody read or searched this long is offered as stale (counts only once the usage log is this old), and a note or record the agent decided on stays out of its lists this long, unless it changes.",
    min: 7,
    max: 365,
  },
  {
    key: "maxNotesPerRun",
    label: "Decisions per run",
    description: "Most notes one run keeps, removes or sends to the tech-writer; the rest wait for the next review task.",
    min: 1,
    max: 50,
  },
  {
    key: "maxLinkFixesPerRun",
    label: "Link fixes per run",
    description: "Most links one run repoints or drops.",
    min: 1,
    max: 200,
  },
  {
    key: "maxRecordsPerRun",
    label: "Register records per run",
    description: "Most open WWW/KI/OQ records one run closes or keeps; the rest wait for the next review task.",
    min: 1,
    max: 100,
  },
  {
    key: "repoRefreshMinutes",
    label: "Repo refresh (minutes)",
    description: "A cached repo is fetched again only when its last fetch is older than this.",
    min: 1,
    max: 1440,
  },
];

// Outside systems PowerLoom can give an agent tools for; each one is switched on per agent in its Config (user decision 2026-10-02).
const INTEGRATIONS: AgentIntegrationSpec[] = [
  {
    key: READ_REPOS_INTEGRATION,
    label: "Read repositories",
    description: "The agent may read the code of the repositories attached to its task (the PBI's, the schedule's, the PR's, the docs project's), as far as they are enabled in Settings. Code review needs it.",
  },
  {
    key: CONFLUENCE_INTEGRATION,
    label: "Confluence (read)",
    description: "The agent may read and search Confluence pages during its runs.",
  },
  {
    key: READ_SQL_INTEGRATION,
    label: "Read SQL (SQL Server)",
    description: "The agent may run read-only queries on the vault's Read SQL connections (Settings) during its runs. Whatever a query returns goes to the model provider.",
  },
  ...AZURE_INTEGRATION_SPECS,
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
    capabilities: { webAccess: false, integrations: { [READ_REPOS_INTEGRATION]: false, [CONFLUENCE_INTEGRATION]: false, [READ_SQL_INTEGRATION]: false, ...AZURE_INTEGRATIONS } },
    skills: ["powerloom-refinement-checklist"],
    options: { batchSize: 2, maxFailures: 3 },
    optionSpecs: REFINEMENT_OPTIONS,
    integrationSpecs: INTEGRATIONS,
    next: "design",
    canAssign: [],
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
    capabilities: { webAccess: false, integrations: { [READ_REPOS_INTEGRATION]: true, [CONFLUENCE_INTEGRATION]: false, [READ_SQL_INTEGRATION]: false, ...AZURE_INTEGRATIONS } },
    skills: ["powerloom-research-checklist"],
    options: { batchSize: 2, maxFailures: 3, maxDepth: 2, repoRefreshMinutes: 30 },
    optionSpecs: RESEARCH_OPTIONS,
    integrationSpecs: INTEGRATIONS,
    next: "design",
    canAssign: [],
    waitFor: ["humanItems", "linkedDocuments", "drafts"],
  },
  {
    id: "better-research",
    label: "Better Research",
    description: "Answers one question with evidence: why a bug happens, how something works, whether something exists, or which options a spike has; decides who works next.",
    enabled: false,
    schedule: "45 * * * *",
    model: { provider: "anthropic", model: "claude-opus-5-5" },
    limits: { maxTurns: 80, timeoutMinutes: 30 },
    budgets: { perRunUsd: 2, dailyUsd: 5 },
    capabilities: { webAccess: true, integrations: { [READ_REPOS_INTEGRATION]: true, [CONFLUENCE_INTEGRATION]: false, [READ_SQL_INTEGRATION]: false, ...AZURE_INTEGRATIONS } },
    skills: ["powerloom-research-checklist"],
    options: { batchSize: 2, maxFailures: 3, maxDepth: 3, maxTasksPerRun: 5, maxTasksPerPbi: 15, repoRefreshMinutes: 30 },
    optionSpecs: BETTER_RESEARCH_OPTIONS,
    integrationSpecs: INTEGRATIONS,
    next: null,
    canAssign: ["better-research", "design"],
    // Its tasks name their dependencies (dependsOn), so it doesn't wait for every open question on the PBI; a draft only
    // adds docs, and a stuck merge would hold it forever (user decision 2026-10-13).
    waitFor: ["linkedDocuments"],
  },
  {
    id: "design",
    label: "Design",
    description: "Writes one implementation design per PBI from refinement and research: approach, alternatives, plan, risks, tests, estimates.",
    enabled: true,
    schedule: "45 */2 * * *",
    model: { provider: "anthropic", model: "claude-opus-5-5" },
    limits: { maxTurns: 60, timeoutMinutes: 20 },
    budgets: { perRunUsd: 3, dailyUsd: 6 },
    capabilities: { webAccess: false, integrations: { [READ_REPOS_INTEGRATION]: true, [CONFLUENCE_INTEGRATION]: true, [READ_SQL_INTEGRATION]: false, ...AZURE_INTEGRATIONS } },
    skills: ["powerloom-design-checklist"],
    options: { batchSize: 1, maxFailures: 3, repoRefreshMinutes: 30 },
    optionSpecs: DESIGN_OPTIONS,
    integrationSpecs: INTEGRATIONS,
    next: null,
    canAssign: [],
    waitFor: ["humanItems", "linkedDocuments", "drafts", "otherAgentTasks"],
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
    capabilities: { webAccess: false, integrations: { [READ_REPOS_INTEGRATION]: true, [CONFLUENCE_INTEGRATION]: false, [READ_SQL_INTEGRATION]: false, ...AZURE_INTEGRATIONS } },
    skills: ["powerloom-tech-writer", "powerloom-documentation"],
    options: { batchSize: 3, maxFailures: 3, repoRefreshMinutes: 30 },
    optionSpecs: TECH_WRITER_OPTIONS,
    integrationSpecs: INTEGRATIONS,
    next: null,
    canAssign: [],
    waitFor: [],
  },
  // Off until the user turns it on (assumption, 2026-10-02): the first pull-requests run queues a review for every open PR.
  {
    id: "code-review",
    label: "Code review",
    description: "Reviews one pull request you review in ADO: comments on files and lines with the code, a summary; reads your answers on reruns. Never writes to ADO.",
    enabled: false,
    schedule: "*/15 * * * *",
    model: { provider: "anthropic", model: "claude-opus-5-5" },
    limits: { maxTurns: 60, timeoutMinutes: 20 },
    budgets: { perRunUsd: 3, dailyUsd: 15 },
    capabilities: { webAccess: false, integrations: { [READ_REPOS_INTEGRATION]: true, [CONFLUENCE_INTEGRATION]: false, [READ_SQL_INTEGRATION]: false, ...AZURE_INTEGRATIONS } },
    skills: ["powerloom-code-review"],
    options: { batchSize: 3, maxFailures: 2, maxDiffLines: 3000, repoRefreshMinutes: 30 },
    optionSpecs: CODE_REVIEW_OPTIONS,
    integrationSpecs: INTEGRATIONS,
    next: null,
    canAssign: [],
    waitFor: [],
  },
  // Picks up the one review task the vault-review job creates when the vaults have candidates (user decision 2026-10-03).
  {
    id: "vault-review",
    label: "Vault review",
    description: "Reviews the vaults chosen in Settings: decides stale and unlinked notes (keep, remove to .trash, actualize via the tech-writer), fixes invalid links, and closes WWW/KI/OQ records the vault already settles or repeats.",
    enabled: true,
    schedule: "0 6 * * 1",
    model: { provider: "anthropic", model: "claude-sonnet-5" },
    limits: { maxTurns: 40, timeoutMinutes: 15 },
    budgets: { perRunUsd: 1, dailyUsd: 3 },
    capabilities: { webAccess: false, integrations: { [READ_REPOS_INTEGRATION]: true, [CONFLUENCE_INTEGRATION]: false, [READ_SQL_INTEGRATION]: false, ...AZURE_INTEGRATIONS } },
    skills: ["powerloom-vault-review", "powerloom-documentation"],
    options: { batchSize: 1, maxFailures: 3, staleDays: 60, maxNotesPerRun: 10, maxLinkFixesPerRun: 30, maxRecordsPerRun: 15, repoRefreshMinutes: 30 },
    optionSpecs: VAULT_REVIEW_OPTIONS,
    integrationSpecs: INTEGRATIONS,
    next: null,
    canAssign: [],
    waitFor: [],
  },
];
