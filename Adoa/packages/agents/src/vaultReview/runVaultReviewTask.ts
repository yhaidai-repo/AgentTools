import { candidateCount, vaultReviewOptions } from "@adoa/core";
import { localItem } from "@adoa/db";
import { listVaults, vaultsExclude } from "@adoa/vault";
import { createRepoTools, type RepoRef } from "@agenttools/runtime";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { AgentRunSession } from "../AgentRunSession";
import { projectRepoName } from "../docsRepos";
import { createFindingTools } from "../findingTools";
import type { AgentRunInfo } from "../models/AgentRunInfo";
import type { AgentRunInput } from "../models/AgentRunInput";
import type { AgentRunResult } from "../models/AgentRunResult";
import type { TaskContext } from "../models/TaskContext";
import type { VaultsAccess } from "../models/VaultsAccess";
import { reposByName } from "../research/resolveRepos";
import { numberOption } from "../stage";
import { commitVaultReview } from "./commitVaultReview";
import type { ReviewLimits } from "./models/ReviewLimits";
import type { VaultReviewDraft } from "./models/VaultReviewDraft";
import { ReviewScope } from "./ReviewScope";
import { createVaultReviewActionTools } from "./vaultReviewActionTools";
import { createVaultReviewReadTools } from "./vaultReviewReadTools";

type ItemRow = typeof localItem.$inferSelect;

const AGENT = "vault-review";

interface ReviewRun {
  acquired: RepoRef[];
  draft: VaultReviewDraft;
}

// One vault-review task (VR-…), one run (user decision 2026-10-03): the agent pulls stale notes, unlinked notes and
// invalid links through its tools and decides each; the actions are applied when the run succeeds.
export async function runVaultReviewTask(context: TaskContext, task: ItemRow): Promise<AgentRunResult> {
  const { deps } = context;
  const vaults = deps.vaults;

  if (!vaults) {
    throw new Error("the vaults root isn't mounted for the agent-runner (VAULTS_DIR)");
  }

  const scope = new ReviewScope(deps.db, vaults.root, await taskVaults(task, vaults), vaultReviewOptions(context.agent.options));
  const info: AgentRunInfo = {
    stage: "vault-review",
    pbiId: null,
    itemId: task.id,
    labels: { agent: AGENT, item: task.id },
    model: context.agent.model,
    promptVersion: context.prompt.version,
  };
  const run: ReviewRun = { acquired: [], draft: { decisions: [], linkFixes: [], findings: [], summary: null } };
  const session = await AgentRunSession.begin(deps, info);

  try {
    const ran = await session.execute(info, () => prepare(context, session, task, scope, run));

    return await session.finish(ran, async () => {
      await commitVaultReview(deps.db, vaults, scope, task, session.runId, run.draft);
    });
  } finally {
    deps.repoCache.release(run.acquired);
  }
}

// The vaults its schedule chose, stored on the task by the producer (user decision 2026-10-03); a vault gone since is skipped.
async function taskVaults(task: ItemRow, vaults: VaultsAccess): Promise<string[]> {
  const available = await listVaults(vaults.root, vaultsExclude());
  const chosen = (task.data as { vaults?: string[] } | null)?.vaults ?? [];

  return chosen.filter((vault) => available.includes(vault));
}

async function prepare(context: TaskContext, session: AgentRunSession, task: ItemRow, scope: ReviewScope, run: ReviewRun): Promise<AgentRunInput> {
  const { deps, agent, prompt, skills } = context;
  const limits: ReviewLimits = { maxNotesPerRun: numberOption(agent, "maxNotesPerRun", 10), maxLinkFixesPerRun: numberOption(agent, "maxLinkFixesPerRun", 30) };

  await session.phase("context", { task: task.id, vaults: scope.vaults, staleDays: scope.options.staleDays, recheckDays: scope.options.recheckDays, ...limits });

  if (scope.vaults.length === 0) {
    throw new Error("none of the task's vaults is available under the vaults root");
  }

  const repos = await vaultRepos(context, scope);

  await session.phase("repos", { repos: repos.map((repo) => repo.name) });
  await deps.repoCache.acquire(repos, (progress) => session.phase("repo", { ...progress }), numberOption(agent, "repoRefreshMinutes", 30));
  run.acquired = repos;

  const firstMessage = await buildFirstMessage(context, task, scope, limits, repos);
  const rules = await vaultRules(scope);

  await session.phase("first-message", { chars: firstMessage.length, vaultRulesChars: rules.length });

  return {
    capabilities: agent.capabilities,
    systemPrompt: [prompt.text, rules, skills.promptSection].filter(Boolean).join("\n\n"),
    firstMessage,
    tools: [
      ...createVaultReviewReadTools(scope),
      ...createVaultReviewActionTools(scope, run.draft, limits),
      ...createFindingTools(deps, run.draft.findings),
      ...createRepoTools({ root: deps.repoCacheRoot, repos: repos.map((repo) => repo.name) }),
      ...skills.tools,
    ],
    limits: { maxTurns: agent.limits.maxTurns, timeoutMs: agent.limits.timeoutMinutes * 60_000 },
    perRunBudgetUsd: agent.budgets.perRunUsd,
    hasRequiredOutput: () => run.draft.summary !== null,
  };
}

// The repos the vaults' projects name in their index notes (`repo:`), when the ADO catalog has them; the agent checks
// whether a note's subject still exists in the code.
async function vaultRepos(context: TaskContext, scope: ReviewScope): Promise<RepoRef[]> {
  const names = await Promise.all(scope.vaults.map((vault) => projectRepoNames(scope.vaultRoot(vault))));
  const unique = [...new Set(names.flat())];

  return unique.length > 0 ? (await reposByName(context.deps.db, unique)).repos : [];
}

async function projectRepoNames(vaultRoot: string): Promise<string[]> {
  const entries = await readdir(vaultRoot, { withFileTypes: true });
  const projects = entries.filter((entry) => entry.isDirectory() && !entry.name.startsWith(".")).map((entry) => entry.name);
  const names = await Promise.all(projects.map((project) => projectRepoName(vaultRoot, project)));

  return names.filter((name): name is string => name !== null);
}

// Each vault's AGENTS.md: the rules every writer follows (user decision 2026-10-02), so link fixes and status changes fit.
async function vaultRules(scope: ReviewScope): Promise<string> {
  const sections = await Promise.all(scope.vaults.map(async (vault) => {
    const rules = await readFile(join(scope.vaultRoot(vault), "AGENTS.md"), "utf8").catch(() => "(no AGENTS.md)");

    return `## Vault rules: ${vault} (its AGENTS.md)\n\n${rules}`;
  }));

  return sections.join("\n\n");
}

async function buildFirstMessage(context: TaskContext, task: ItemRow, scope: ReviewScope, limits: ReviewLimits, repos: RepoRef[]): Promise<string> {
  const counts = await Promise.all(scope.vaults.map(async (vault) => {
    const candidates = await scope.candidates(vault);

    return `- ${vault}: ${candidates.stale.length} stale, ${candidates.unlinked.length} unlinked, ${candidates.deadLinks.length} dead link(s) (${candidateCount(candidates)} in all)`;
  }));
  const docsVault = context.deps.docsVaultName;

  return [
    "Review the vaults: decide each stale or unlinked note (keep, remove, actualize) and fix invalid links. Pull the candidates with the list tools.",
    `<task>\nId: ${task.id}\nVaults: ${scope.vaults.join(", ")}\nStale after: ${scope.options.staleDays} days without use\nDecisions this run: at most ${limits.maxNotesPerRun}\nLink fixes this run: at most ${limits.maxLinkFixesPerRun}\n</task>`,
    `<candidates>\n${counts.join("\n")}\n</candidates>`,
    `<findings>\n${docsVault ? `Findings go to the registers of the ${docsVault} vault only; for notes of other vaults, put open points in the summary.` : "No register is available: put open points in the summary."}\n</findings>`,
    `<repos>\n${repos.map((repo) => `- ${repo.name} (branch ${repo.defaultBranch})`).join("\n") || "none: no project index names a repo in the catalog"}\n</repos>`,
  ].join("\n\n");
}
