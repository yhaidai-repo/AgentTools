import type { AgentDefinition, AgentIntegrationSpec, AgentOptionSpec, AgentsGlobal } from "@agenttools/config";
import { CONFLUENCE_INTEGRATION } from "./confluenceTools";
import { AZURE_INTEGRATIONS, AZURE_INTEGRATION_SPECS } from "./azure/azureIntegrations";
import { READ_REPOS_INTEGRATION } from "./repos/openRepos";
import { DEVHUB_INTEGRATION } from "./devHubTools";
import { ADO_INTEGRATION } from "./ado/adoTools";
import { READ_SQL_INTEGRATION } from "./sqlTools";
import { ESTIMATE_INTEGRATION } from "./estimate/estimateTool";
import { RESEARCH_RESULT_INTEGRATION } from "./betterResearch/ResearchResultWriter";
import { WRITE_NOTES_INTEGRATION } from "./techWriter/TechWriterWriter";
import { VAULT_REVIEW_INTEGRATION } from "./vaultReview/VaultReviewWriter";
import { WRITE_DESIGN_INTEGRATION } from "./design/DesignWriter";
import { WRITE_REFINEMENT_INTEGRATION } from "./betterRefinement/RefinementWriter";
import { CODE_REVIEW_INTEGRATION } from "./codeReview/ReviewWriter";
import { BETTER_REVIEW_INTEGRATION } from "./betterReview/BetterReviewWriter";
import { AUTOTEST_INTEGRATION } from "./autotest/AutotestWriter";

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

// What the shared toolset reads on every agent (user decision 2026-10-14): create_task's caps and open_repo's.
const TOOLSET_OPTIONS: AgentOptionSpec[] = [
  ...TASK_CREATION_OPTIONS,
  {
    key: "maxOpenedRepos",
    label: "Repos opened per run",
    description: "Most repos of the catalog one run may add with open_repo beyond the ones attached to its task; a clone of a big repo takes minutes.",
    min: 0,
    max: 20,
  },
];

// An agent's own options first, then the toolset's it doesn't declare itself.
function withToolsetOptions(specs: AgentOptionSpec[]): AgentOptionSpec[] {
  const declared = new Set(specs.map((spec) => spec.key));

  return [...specs, ...TOOLSET_OPTIONS.filter((spec) => !declared.has(spec.key))];
}

// The browser DevHub drives for a test: hidden (1), or a window on the host to watch (0) (user request 2026-10-20).
const HEADLESS_OPTION: AgentOptionSpec = {
  key: "headless",
  label: "Headless browser",
  description: "1: the test browser runs hidden on the host. 0: a browser window opens on the host, so you can watch the test; recordings are made either way.",
  min: 0,
  max: 1,
};

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

const BETTER_REFINEMENT_OPTIONS: AgentOptionSpec[] = [
  batchSizeOption("PBIs"),
  {
    key: "maxFailures",
    label: "Failures before skipping a PBI",
    description: "After this many failed runs on one PBI, refinement stops picking it until you prepare it again in the Backlog.",
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

const BETTER_REVIEW_OPTIONS: AgentOptionSpec[] = [
  ...CODE_REVIEW_OPTIONS,
  ...TASK_CREATION_OPTIONS,
];

const VAULT_REVIEW_OPTIONS: AgentOptionSpec[] = [
  batchSizeOption("Review tasks"),
  {
    key: "maxFailures",
    label: "Failures before blocking a review task",
    description: "After this many failed runs, the review task is set to blocked; its schedule creates no new one while it waits.",
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

// Outside systems PowerLoom can give an agent tools for, and PowerLoom's own grants; each one is switched on per agent in
// its Config (user decision 2026-10-02).
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
  {
    key: DEVHUB_INTEGRATION,
    label: "DevHub (run services)",
    description: "The agent may start, inspect and stop a chain of the vault's services on the Windows host (Settings → DevHub) during its runs, e.g. the PVS portal with Signals for a test. One stack at a time; it stops when the run ends.",
  },
  {
    key: ADO_INTEGRATION,
    label: "Azure DevOps (read)",
    description: "The agent may read Azure DevOps with the vault's PAT (Settings → Azure DevOps): any work item with its links and comments, WIQL queries, pull requests with their reviewers, changed files and comment threads, and its PBI's Test Cases (Tested By), which are saved to the PBI as TC-<id> for later agents and chats. Pull requests need the PAT's Code (Read) scope.",
  },
  // Refinement must estimate, design may (user decision 2026-10-18).
  {
    key: ESTIMATE_INTEGRATION,
    label: "Give estimates",
    description: "The agent may record an estimate of its PBI with record_estimate: hours for a developer without an agent and hours for an agent implementing it. The PBI shows the latest estimate from any agent. Refinement agents must give one when this is on.",
  },
  // Output tools are granted like readers (user decision 2026-10-22); the first one shared, Better Research's (stage 2b).
  {
    key: RESEARCH_RESULT_INTEGRATION,
    label: "Write research results",
    description: "The agent may answer its task with write_research_result: a research result item (RR) on the PBI or task, with findings, evidence and the next steps; earlier results of the task are superseded and the task is closed.",
  },
  {
    key: WRITE_NOTES_INTEGRATION,
    label: "Write vault notes",
    description: "The agent may write notes in its task's vault with write_note and record findings for the vault registers: a draft merged into the docs vault, a note actualized in place, or a docs request. The vault's AGENTS.md joins its instructions.",
  },
  {
    key: VAULT_REVIEW_INTEGRATION,
    label: "Review a vault",
    description: "The agent may review its task's vault: list its stale and unlinked notes, dead links and open records, decide each (keep, remove, actualize; fix; close), and write the review summary. The decisions are applied when the run succeeds.",
  },
  {
    key: WRITE_DESIGN_INTEGRATION,
    label: "Write designs",
    description: "The agent may design its PBI with write_design (approach, alternatives, plan, risks, tests) or name the questions that stop a design; the first message carries the PBI, its refinement and every research result. With a design the task is done, without one it waits for its gaps.",
  },
  {
    key: WRITE_REFINEMENT_INTEGRATION,
    label: "Write refinements",
    description: "The agent may refine its PBI with write_refinement (summary, scope, gaps, dependencies, repos, blockers, skills) after record_estimate when estimates are granted; the first message carries the PBI as refinement reads it. The readiness gates read the latest refinement.",
  },
  {
    key: CODE_REVIEW_INTEGRATION,
    label: "Review code (comments and summary)",
    description: "The agent reviews its task's pull request: the PR is checked out for the repo tools, its diff is in the first message, and add_review_comment, update_comment and write_review_summary record the review. Needs Read repositories.",
  },
  {
    key: BETTER_REVIEW_INTEGRATION,
    label: "Review pull requests (Better Review)",
    description: "The agent reviews its task's pull request against its PBIs, the repo's review rules and the other reviewers' threads, with follow-ups anchored to the last reviewed commit; the PR is checked out for the repo tools. Needs Read repositories.",
  },
  {
    key: AUTOTEST_INTEGRATION,
    label: "Write test reports",
    description: "The agent proves its PBI's acceptance criteria: the test cases, design and previous report are in the first message; write_test_report and report_bug record what it found. A report that waits for an answer sends the task back to open.",
  },
];

export const AGENT_DEFAULTS: AgentDefinition[] = [
  {
    id: "better-refinement",
    label: "Better Refinement",
    description: "Makes a PBI developable: collects all its information, checks repos and affected areas in the code, test data, dependencies and blockers, and creates the tasks that close the gaps.",
    enabled: false,
    schedule: "15 * * * *",
    model: { provider: "anthropic", model: "claude-opus-5-5" },
    limits: { maxTurns: 60, timeoutMinutes: 20 },
    budgets: { perRunUsd: 2, dailyUsd: 5 },
    capabilities: { webAccess: true, integrations: { [READ_REPOS_INTEGRATION]: true, [CONFLUENCE_INTEGRATION]: false, [READ_SQL_INTEGRATION]: false, ...AZURE_INTEGRATIONS, [DEVHUB_INTEGRATION]: false, [ADO_INTEGRATION]: false, [ESTIMATE_INTEGRATION]: true, [WRITE_REFINEMENT_INTEGRATION]: true } },
    skills: ["powerloom-refinement-checklist"],
    options: { batchSize: 2, maxFailures: 3, maxDepth: 3, maxTasksPerRun: 5, maxTasksPerPbi: 15, repoRefreshMinutes: 30 },
    optionSpecs: withToolsetOptions(BETTER_REFINEMENT_OPTIONS),
    integrationSpecs: INTEGRATIONS,
    canAssign: ["research", "design", "docs"],
    handles: ["refinement"],
    // Its tasks name their dependencies, and the documents it needs are linked to the PBI (user decision 2026-10-13).
    waitFor: ["linkedDocuments"],
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
    capabilities: { webAccess: true, integrations: { [READ_REPOS_INTEGRATION]: true, [CONFLUENCE_INTEGRATION]: false, [READ_SQL_INTEGRATION]: false, ...AZURE_INTEGRATIONS, [DEVHUB_INTEGRATION]: false, [ADO_INTEGRATION]: false, [ESTIMATE_INTEGRATION]: false, [RESEARCH_RESULT_INTEGRATION]: true } },
    skills: ["powerloom-research-checklist"],
    options: { batchSize: 2, maxFailures: 3, maxDepth: 3, maxTasksPerRun: 5, maxTasksPerPbi: 15, repoRefreshMinutes: 30 },
    optionSpecs: withToolsetOptions(BETTER_RESEARCH_OPTIONS),
    integrationSpecs: INTEGRATIONS,
    canAssign: ["research", "design"],
    handles: ["research"],
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
    capabilities: { webAccess: false, integrations: { [READ_REPOS_INTEGRATION]: true, [CONFLUENCE_INTEGRATION]: true, [READ_SQL_INTEGRATION]: false, ...AZURE_INTEGRATIONS, [DEVHUB_INTEGRATION]: false, [ADO_INTEGRATION]: false, [ESTIMATE_INTEGRATION]: true, [WRITE_DESIGN_INTEGRATION]: true } },
    skills: ["powerloom-design-checklist"],
    options: { batchSize: 1, maxFailures: 3, repoRefreshMinutes: 30 },
    optionSpecs: withToolsetOptions(DESIGN_OPTIONS),
    integrationSpecs: INTEGRATIONS,
    canAssign: [],
    handles: ["design"],
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
    capabilities: { webAccess: false, integrations: { [READ_REPOS_INTEGRATION]: true, [CONFLUENCE_INTEGRATION]: false, [READ_SQL_INTEGRATION]: false, ...AZURE_INTEGRATIONS, [DEVHUB_INTEGRATION]: false, [ADO_INTEGRATION]: false, [ESTIMATE_INTEGRATION]: false, [WRITE_NOTES_INTEGRATION]: true } },
    skills: ["powerloom-tech-writer", "powerloom-documentation"],
    options: { batchSize: 3, maxFailures: 3, repoRefreshMinutes: 30 },
    optionSpecs: withToolsetOptions(TECH_WRITER_OPTIONS),
    integrationSpecs: INTEGRATIONS,
    canAssign: [],
    handles: ["docs"],
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
    capabilities: { webAccess: false, integrations: { [READ_REPOS_INTEGRATION]: true, [CONFLUENCE_INTEGRATION]: false, [READ_SQL_INTEGRATION]: false, ...AZURE_INTEGRATIONS, [DEVHUB_INTEGRATION]: false, [ADO_INTEGRATION]: false, [ESTIMATE_INTEGRATION]: false, [CODE_REVIEW_INTEGRATION]: true } },
    skills: ["powerloom-code-review"],
    options: { batchSize: 3, maxFailures: 2, maxDiffLines: 3000, repoRefreshMinutes: 30 },
    optionSpecs: withToolsetOptions(CODE_REVIEW_OPTIONS),
    integrationSpecs: INTEGRATIONS,
    canAssign: [],
    handles: ["review"],
    waitFor: [],
  },
  // Takes the same review tasks as Code review (user decision 2026-10-16: a new agent; switch one off and the other on).
  // Azure DevOps (read) is on so it reads the other reviewers' threads; create_task hands open questions to research.
  {
    id: "better-review",
    label: "Better Review",
    description: "Reviews one pull request against its PBIs' goals and acceptance criteria, the business logic and the repo's own style; follows the repo's review rules, weighs the other reviewers' comments, learns decisions and lessons into the rules, asks research when unsure, and after fixes reviews only what changed since its last review. Never writes to ADO.",
    enabled: false,
    schedule: "*/15 * * * *",
    model: { provider: "anthropic", model: "claude-opus-5-5" },
    limits: { maxTurns: 80, timeoutMinutes: 30 },
    budgets: { perRunUsd: 4, dailyUsd: 20 },
    capabilities: { webAccess: false, integrations: { [READ_REPOS_INTEGRATION]: true, [CONFLUENCE_INTEGRATION]: false, [READ_SQL_INTEGRATION]: false, ...AZURE_INTEGRATIONS, [DEVHUB_INTEGRATION]: false, [ADO_INTEGRATION]: true, [ESTIMATE_INTEGRATION]: false, [BETTER_REVIEW_INTEGRATION]: true } },
    skills: ["powerloom-better-review", "powerloom-code-review"],
    options: { batchSize: 3, maxFailures: 2, maxDiffLines: 3000, maxDepth: 2, maxTasksPerRun: 3, maxTasksPerPbi: 15, repoRefreshMinutes: 30 },
    optionSpecs: withToolsetOptions(BETTER_REVIEW_OPTIONS),
    integrationSpecs: INTEGRATIONS,
    canAssign: ["research"],
    handles: ["review"],
    waitFor: [],
  },
  // Picks up vault-review tasks: a schedule's (one waits at a time) or one the user creates (task type since 2026-10-18).
  {
    id: "vault-review",
    label: "Vault review",
    description: "Reviews the vaults chosen in Settings: decides stale and unlinked notes (keep, remove to .trash, actualize via the tech-writer), fixes invalid links, and closes WWW/KI/OQ records the vault already settles or repeats.",
    enabled: true,
    schedule: "0 6 * * 1",
    model: { provider: "anthropic", model: "claude-sonnet-5" },
    limits: { maxTurns: 40, timeoutMinutes: 15 },
    budgets: { perRunUsd: 1, dailyUsd: 3 },
    capabilities: { webAccess: false, integrations: { [READ_REPOS_INTEGRATION]: true, [CONFLUENCE_INTEGRATION]: false, [READ_SQL_INTEGRATION]: false, ...AZURE_INTEGRATIONS, [DEVHUB_INTEGRATION]: false, [ADO_INTEGRATION]: false, [ESTIMATE_INTEGRATION]: false, [VAULT_REVIEW_INTEGRATION]: true } },
    skills: ["powerloom-vault-review", "powerloom-documentation"],
    options: { batchSize: 1, maxFailures: 3, staleDays: 60, maxNotesPerRun: 10, maxLinkFixesPerRun: 30, maxRecordsPerRun: 15, repoRefreshMinutes: 30 },
    optionSpecs: withToolsetOptions(VAULT_REVIEW_OPTIONS),
    integrationSpecs: INTEGRATIONS,
    canAssign: [],
    handles: ["vault-review"],
    waitFor: [],
  },
  // Turns each recorded meeting (MT-…, from tools/audio-capture) into notes in its vault and the follow-ups it asked for;
  // off until the user turns it on (user decision 2026-10-14, stage 4 of the audio capture design).
  {
    id: "autotest",
    label: "Autotest",
    description: "Proves a PBI's acceptance criteria end to end: analyses them against the test cases, plans the cases, runs them on a local stack with a recorded browser, reports verdicts and bugs.",
    enabled: false,
    schedule: "15 * * * *",
    model: { provider: "anthropic", model: "claude-opus-5-5" },
    limits: { maxTurns: 120, timeoutMinutes: 45 },
    budgets: { perRunUsd: 10, dailyUsd: 20 },
    // DevHub (the stack and the browser) and the ADO test cases are its job (user decisions 2026-10-20).
    capabilities: { webAccess: false, integrations: { [READ_REPOS_INTEGRATION]: true, [CONFLUENCE_INTEGRATION]: false, [READ_SQL_INTEGRATION]: false, ...AZURE_INTEGRATIONS, [DEVHUB_INTEGRATION]: true, [ADO_INTEGRATION]: true, [ESTIMATE_INTEGRATION]: false, [AUTOTEST_INTEGRATION]: true } },
    skills: ["powerloom-autotest-checklist"],
    options: { batchSize: 1, maxFailures: 3, maxDepth: 3, maxTasksPerRun: 8, maxTasksPerPbi: 20, repoRefreshMinutes: 30, headless: 1 },
    optionSpecs: withToolsetOptions([...BETTER_RESEARCH_OPTIONS, HEADLESS_OPTION]),
    integrationSpecs: INTEGRATIONS,
    canAssign: ["research"],
    handles: ["test"],
    waitFor: ["linkedDocuments"],
  },
];
