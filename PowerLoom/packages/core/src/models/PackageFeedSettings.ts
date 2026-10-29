import type { PackageFeed } from "./PackageFeed";

// The vault setting `packageFeeds` as stored: {"feeds": [{"url", "username", "token"}]}.
export interface PackageFeedSettings {
  feeds: PackageFeed[];
}
