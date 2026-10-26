// A vault's GitHub (user decision 2026-10-25), as the .NET backend saves it: the token reads its repos and pull requests.
export interface GitHubSettings {
  enabled: boolean;
  token: string;
  /** A user or organization; empty: every repo the token can read. */
  owner: string;
  /** The token's user, read when the settings were saved. */
  login: string;
}
