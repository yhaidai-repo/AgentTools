// A vault's Azure DevOps integration (user decision 2026-10-06: per vault, with its own token and switch). PBI sync, mail
// sync and pull request sync exist only while it is enabled and configured.
export interface AdoSettings {
  enabled: boolean;
  orgUrl: string;
  project: string;
  team: string;
  user: string;
  /** Personal access token (Work Items Read, Code Read); stored in the database, never shown again. */
  pat: string;
}
