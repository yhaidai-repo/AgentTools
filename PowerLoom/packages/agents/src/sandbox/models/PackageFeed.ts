// A private package feed of a vault (vault setting `packageFeeds`), signed in to by its restores only. The token never
// reaches an image, a sandbox command or a log: it goes to the restore container as a variable of its NuGet steps.
export interface PackageFeed {
  /** The feed's URL, or a prefix covering several feeds (e.g. an Azure Artifacts organization's
   *  https://pkgs.dev.azure.com/<org>/): every source of the repo's nuget.config or .npmrc under it gets the sign-in. */
  url: string;
  /** The user name the feed expects; Azure Artifacts takes any. */
  username?: string;
  /** A personal access token with read rights on the feed's packages. */
  token: string;
}
