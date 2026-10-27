import { candidateCount, vaultReviewOptions } from "@powerloom/core";
import type { localItem } from "@powerloom/db";
import { listVaults, vaultsExclude } from "@powerloom/vault";
import type { ToolDefinition } from "@agenttools/runtime";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { projectRepoName } from "../docsRepos";
import type { ReadLog } from "../evidence/ReadLog";
import { createFindingTools } from "../findingTools";
import type { RepoSource } from "../models/RepoSource";
import type { TaskContext } from "../models/TaskContext";
import type { VaultsAccess } from "../models/VaultsAccess";
import { numberOption } from "../stage";
import type { RunWriter } from "../toolset/models/RunWriter";
import type { WriterTarget } from "../toolset/models/WriterTarget";
import { commitVaultReview } from "./commitVaultReview";
import type { ReviewLimits } from "./models/ReviewLimits";
import type { VaultReviewDraft } from "./models/VaultReviewDraft";
import { ReviewScope } from "./ReviewScope";
import { createVaultReviewActionTools } from "./vaultReviewActionTools";
import { createVaultReviewReadTools } from "./vaultReviewReadTools";
import { createVaultReviewRecordTools } from "./vaultReviewRecordTools";

type ItemRow = typeof localItem.$inferSelect;

export const VAULT_REVIEW_INTEGRATION = "reviewVault";

// The vault review's tools as a granted writer (stage 2b, 2026-10-23): the task's vault is listed for stale and unlinked
// notes, dead links and open records; the decisions, link fixes and record closings are applied once the run succeeds.
export class VaultReviewWriter implements RunWriter {
  readonly integration = VAULT_REVIEW_INTEGRATION;
  commitDraft(): unknown { return this.draft; }

  private readonly draft: VaultReviewDraft = { decisions: [], linkFixes: [], records: [], findings: [], summary: null };
  private readonly limits: ReviewLimits;
  private scope: ReviewScope | null = null;

  constructor(private readonly context: TaskContext) {
    this.limits = {
      maxNotesPerRun: numberOption(context.agent, "maxNotesPerRun", 10),
      maxLinkFixesPerRun: numberOption(context.agent, "maxLinkFixesPerRun", 30),
      maxRecordsPerRun: numberOption(context.agent, "maxRecordsPerRun", 15),
    };
  }

  // The repos the vault's projects name in their index notes (`repo:`): the agent checks whether a note's subject still
  // exists in the code.
  async repoSources(task: ItemRow): Promise<RepoSource[]> {
    const scope = await this.scopeOf(task);

    return Promise.all(scope.vaults.map(async (vault) => ({ vault, names: await projectRepoNames(scope.vaultRoot(vault)) })));
  }

  tools(log: ReadLog): ToolDefinition<any>[] {
    const scope = this.requireScope();

    return [
      ...createVaultReviewReadTools(scope),
      ...createVaultReviewActionTools(scope, this.draft, this.limits),
      ...createVaultReviewRecordTools(scope, this.draft, this.limits),
      ...createFindingTools(this.context.deps, this.draft.findings),
    ];
  }

  async contextBlocks(task: ItemRow): Promise<string[]> {
    const scope = await this.scopeOf(task);
    const counts = await Promise.all(scope.vaults.map(async (vault) => {
      const candidates = await scope.candidates(vault);

      return `- ${vault}: ${candidates.stale.length} stale, ${candidates.unlinked.length} unlinked, ${candidates.deadLinks.length} dead link(s), ${candidates.records.length} open record(s) (${candidateCount(candidates)} in all)`;
    }));
    const docsVault = this.context.deps.docsVaultName;
    const caps = [
      `Decisions this run: at most ${this.limits.maxNotesPerRun}`,
      `Link fixes this run: at most ${this.limits.maxLinkFixesPerRun}`,
      `Records this run: at most ${this.limits.maxRecordsPerRun}`,
    ];

    return [
      "Review the vault: decide each stale or unlinked note (keep, remove, actualize), fix invalid links, and close or keep each open WWW/KI/OQ record. Pull the candidates with the list tools.",
      `<review>\nVaults: ${scope.vaults.join(", ")}\nReview period: ${scope.options.staleDays} days (unused this long = stale)\n${caps.join("\n")}\n</review>`,
      `<candidates>\n${counts.join("\n")}\n</candidates>`,
      `<findings>\n${docsVault ? `Findings go to the registers of the ${docsVault} vault only; for notes of other vaults, put open points in the summary.` : "No register is available: put open points in the summary."}\n</findings>`,
    ];
  }

  // Each vault's rules: the ones every writer follows (user decision 2026-10-02), so link fixes and status changes fit.
  async promptSections(task: ItemRow): Promise<string[]> {
    const scope = await this.scopeOf(task);

    return Promise.all(scope.vaults.map(async (vault) => {
      const rules = await readFile(join(scope.vaultRoot(vault), "AGENTS.md"), "utf8").catch(() => "(no AGENTS.md)");

      return `## Vault rules: ${vault} (its AGENTS.md)\n\n${rules}`;
    }));
  }

  async commit(target: WriterTarget): Promise<string[]> {
    const scope = await this.scopeOf(target.task);

    this.draft.summary ??= target.result?.body ?? null;
    await commitVaultReview(target.deps.db, this.vaults(), scope, target.task, target.runId, this.draft);

    return [];
  }

  // The task's own vault (a task type since 2026-10-18); a vault gone since fails the run.
  private async scopeOf(task: ItemRow): Promise<ReviewScope> {
    if (this.scope) {
      return this.scope;
    }

    const vaults = this.vaults();
    const available = await listVaults(vaults.root, vaultsExclude());

    if (!available.includes(task.vault)) {
      throw new Error(`the task's vault ${task.vault} isn't under the vaults root`);
    }

    this.scope = new ReviewScope(this.context.deps.db, vaults.root, [task.vault], vaultReviewOptions(this.context.agent.options));

    return this.scope;
  }

  private requireScope(): ReviewScope {
    if (!this.scope) {
      throw new Error("the vault review's scope is built with its first-message blocks before its tools");
    }

    return this.scope;
  }

  private vaults(): VaultsAccess {
    if (!this.context.deps.vaults) {
      throw new Error("the vaults root isn't mounted for the agent-runner (VAULTS_DIR)");
    }

    return this.context.deps.vaults;
  }
}

async function projectRepoNames(vaultRoot: string): Promise<string[]> {
  const entries = await readdir(vaultRoot, { withFileTypes: true });
  const projects = entries.filter((entry) => entry.isDirectory() && !entry.name.startsWith(".")).map((entry) => entry.name);
  const names = await Promise.all(projects.map((project) => projectRepoName(vaultRoot, project)));

  return names.filter((name): name is string => name !== null);
}
