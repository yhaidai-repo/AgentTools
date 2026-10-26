// How the vault's last GitHub pull request check went, as the backend records it: when, what it found, or why it failed.
export interface GitHubCheckStatus {
  checkedAt: string | null;
  summary: string;
  error: string | null;
}
