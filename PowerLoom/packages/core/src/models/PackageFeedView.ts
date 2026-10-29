// A private package feed as a chat may see it (settings_get, sandbox_savePackageFeed): never the token, only that one is saved.
export interface PackageFeedView {
  url: string;
  username: string;
  hasToken: boolean;
}
