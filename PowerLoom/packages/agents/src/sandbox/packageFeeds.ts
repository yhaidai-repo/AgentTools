import { readPackageFeedSettings, type PackageFeed } from "@powerloom/core";
import type { PowerLoomDb } from "@powerloom/db";
import type { FeedCredential } from "@powerloom/sandbox";
import { adoFeedHosts } from "./adoFeedCredential";

// Azure Artifacts' feed hosts; its packages download from the organization's blob storage.
const AZURE_ARTIFACTS = /^https:\/\/pkgs\.dev\.azure\.com\/([^/]+)|^https:\/\/([^.]+)\.pkgs\.visualstudio\.com/i;
const DEFAULT_USERNAME = "powerloom";

/** The vault's feeds that have an https URL and a token (a row edited by hand may lack either); none until the setting is saved. */
export async function readPackageFeeds(db: PowerLoomDb, vault: string): Promise<PackageFeed[]> {
  const settings = await readPackageFeedSettings(db, vault);

  return settings.feeds.filter((feed) => isHttpsUrl(feed?.url) && typeof feed.token === "string" && feed.token.length > 0);
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
