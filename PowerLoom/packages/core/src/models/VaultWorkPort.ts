import type { AddedVault } from "./AddedVault";
import type { Outcome } from "./Outcome";
import type { RepoSummary } from "./RepoSummary";

// The vault, repository, trash, cleanup and dead-letter changes the web made through the API directly before stage 3
// of the powerloom-mcp design.
export interface VaultWorkPort {
  setRepoEnabled(vault: string, id: string, enabled: boolean): Promise<Outcome<void>>;
  addLocalRepo(vault: string, name: string): Promise<Outcome<RepoSummary>>;
  removeRepo(vault: string, id: string): Promise<Outcome<void>>;
  // Adds a folder of the vaults root as a vault and prepares it from the templates.
  addVault(folder: string): Promise<Outcome<AddedVault>>;
  // Forgets the vault and stops its schedules; its folder stays.
  removeVault(vault: string): Promise<Outcome<string>>;
  restoreTrash(vault: string, path: string): Promise<Outcome<string>>;
  deleteTrash(vault: string, path: string): Promise<Outcome<string>>;
  // Starts the vault's cleanup with its saved settings (dry run until switched off).
  runCleanup(vault: string): Promise<Outcome<void>>;
  replayDeadLetter(id: string): Promise<Outcome<string>>;
  discardDeadLetter(id: string): Promise<Outcome<string>>;
}
