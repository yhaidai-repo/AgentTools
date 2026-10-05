import { reviewCandidates, type VaultReviewCandidates, type VaultReviewOptions } from "@adoa/core";
import type { AdoaDb } from "@adoa/db";
import { scanVault, type VaultIndex } from "@adoa/vault";
import { join } from "node:path";

// The vaults one review run covers. Each is scanned once per run: the agent's actions are staged until the commit, so the
// files it reviews don't change in between.
export class ReviewScope {
  private readonly indexes = new Map<string, Promise<VaultIndex>>();
  private readonly candidateLists = new Map<string, Promise<VaultReviewCandidates>>();

  constructor(
    private readonly db: AdoaDb,
    readonly root: string,
    readonly vaults: string[],
    readonly options: VaultReviewOptions,
  ) {}

  hasVault(vault: string): boolean {
    return this.vaults.includes(vault);
  }

  vaultRoot(vault: string): string {
    return join(this.root, vault);
  }

  index(vault: string): Promise<VaultIndex> {
    if (!this.indexes.has(vault)) {
      this.indexes.set(vault, scanVault(this.root, vault));
    }

    return this.indexes.get(vault)!;
  }

  candidates(vault: string): Promise<VaultReviewCandidates> {
    if (!this.candidateLists.has(vault)) {
      this.candidateLists.set(vault, this.index(vault).then((index) => reviewCandidates(this.db, index, this.options)));
    }

    return this.candidateLists.get(vault)!;
  }
}
