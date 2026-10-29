import type { PowerLoomDb } from "@powerloom/db";
import { z } from "zod";
import type { PackageFeed } from "./models/PackageFeed";
import type { PackageFeedSettings } from "./models/PackageFeedSettings";
import type { PackageFeedView } from "./models/PackageFeedView";
import type { Outcome } from "./models/Outcome";
import { readValue, saveValue, vaultSettingKey } from "./settings";

// The vault's private package feeds and their tokens (a `config` row, like the vault's other tokens).
export const PACKAGE_FEEDS_KEY = "packageFeeds";

/** A feed's URL as a command's input: https only, since the token travels with every request under it. */
export const feedUrlInput = z.string().trim().url().refine((url) => new URL(url).protocol === "https:", "an https URL").describe("The feed's URL, or a prefix covering several feeds (e.g. https://pkgs.dev.azure.com/<org>/)");

export async function readPackageFeedSettings(db: PowerLoomDb, vault: string): Promise<PackageFeedSettings> {
  const stored = await readValue<Partial<PackageFeedSettings>>(db, vaultSettingKey(vault, PACKAGE_FEEDS_KEY));

  return { feeds: stored?.feeds ?? [] };
}

/** The feeds without their tokens, for a chat. */
export function packageFeedsView(settings: PackageFeedSettings): PackageFeedView[] {
  return settings.feeds.map((feed) => ({ url: feed.url, username: feed.username ?? "", hasToken: typeof feed.token === "string" && feed.token.length > 0 }));
}

/** Adds the feed, or replaces the one with its URL; an empty token keeps the saved one. The feeds without tokens, or why not. */
export async function savePackageFeed(db: PowerLoomDb, vault: string, feed: PackageFeed): Promise<Outcome<PackageFeedView[]>> {
  const settings = await readPackageFeedSettings(db, vault);
  const existing = feedWithUrl(settings, feed.url);
  const token = feed.token || existing?.token || "";

  if (token.length === 0) {
    return { ok: false, error: `No token saved for ${feed.url} yet: give one.` };
  }

  const kept = withFeed(settings, { url: feed.url, username: feed.username || undefined, token });

  await saveValue(db, vaultSettingKey(vault, PACKAGE_FEEDS_KEY), kept);

  return { ok: true, value: packageFeedsView(kept) };
}

/** Drops the feed with the URL; null when there is none. */
export async function removePackageFeed(db: PowerLoomDb, vault: string, url: string): Promise<PackageFeedView[] | null> {
  const settings = await readPackageFeedSettings(db, vault);

  if (!feedWithUrl(settings, url)) {
    return null;
  }

  const kept = { feeds: settings.feeds.filter((feed) => !sameUrl(feed.url, url)) };

  await saveValue(db, vaultSettingKey(vault, PACKAGE_FEEDS_KEY), kept);

  return packageFeedsView(kept);
}

function feedWithUrl(settings: PackageFeedSettings, url: string): PackageFeed | undefined {
  return settings.feeds.find((feed) => sameUrl(feed.url, url));
}

// The feed keeps its place in the list, so the order the restores try the prefixes in stays as saved.
function withFeed(settings: PackageFeedSettings, feed: PackageFeed): PackageFeedSettings {
  const feeds = settings.feeds.map((saved) => (sameUrl(saved.url, feed.url) ? feed : saved));

  return { feeds: feedWithUrl(settings, feed.url) ? feeds : [...feeds, feed] };
}

function sameUrl(left: string, right: string): boolean {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}
