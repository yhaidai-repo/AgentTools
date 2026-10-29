import { readValue, vaultSettingKey } from "@powerloom/core";
import type { PowerLoomDb } from "@powerloom/db";
import type { FeedCredential } from "@powerloom/sandbox";
import { adoFeedHosts } from "./adoFeedCredential";
import type { PackageFeed } from "./models/PackageFeed";
import type { PackageFeedSettings } from "./models/PackageFeedSettings";

// The vault's private package feeds and their tokens (a `config` row, like the vault's other tokens).
export const PACKAGE_FEEDS_KEY = "packageFeeds";

// Azure Artifacts' feed hosts; its packages download from the organization's blob storage.
const AZURE_ARTIFACTS = /^https:\/\/pkgs\.dev\.azure\.com\/([^/]+)|^https:\/\/([^.]+)\.pkgs\.visualstudio\.com/i;
const DEFAULT_USERNAME = "powerloom";

/** The vault's feeds that have a URL and a token; none until the setting is saved. */
export async function readPackageFeeds(db: PowerLoomDb, vault: string): Promise<PackageFeed[]> {
  const stored = await readValue<Partial<PackageFeedSettings>>(db, vaultSettingKey(vault, PACKAGE_FEEDS_KEY));

  return (stored?.feeds ?? []).filter((feed) => isHttpsUrl(feed?.url) && typeof feed.token === "string" && feed.token.length > 0);
}

/** The feed's sign-in for restores: the sources under its URL get it. */
export function feedCredentialOf(feed: PackageFeed): FeedCredential {
  return { urlPrefixes: [feed.url], username: feed.username || DEFAULT_USERNAME, password: feed.token };
}

/** The hosts a restore of the feed reaches: its own, and for Azure Artifacts both of its host names and its blob storage. */
export function feedHostsOf(feed: PackageFeed): string[] {
  const organization = AZURE_ARTIFACTS.exec(feed.url);

  if (organization) {
    return adoFeedHosts(`https://dev.azure.com/${organization[1] ?? organization[2]}`);
  }

  return [new URL(feed.url).hostname.toLowerCase()];
}

function isHttpsUrl(url: unknown): url is string {
  return typeof url === "string" && URL.canParse(url) && new URL(url).protocol === "https:";
}
