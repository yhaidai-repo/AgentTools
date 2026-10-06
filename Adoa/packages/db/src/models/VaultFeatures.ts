// What adoa does for a vault; each can be switched off (user decision 2026-10-05).
export interface VaultFeatures {
  adoSync: boolean; // pull the vault's PBIs from Azure DevOps
  mailSync: boolean; // import PBIs from the vault's folder of the import inbox
  pullRequests: boolean; // mirror the pull requests to review
}
