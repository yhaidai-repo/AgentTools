import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PowerLoomDb } from "@powerloom/db";
import { packageFeedsView, readPackageFeedSettings, removePackageFeed, savePackageFeed } from "./packageFeeds";

// The config table as one key → value map: what readValue and saveValue reach.
function fakeConfigDb(store: Map<string, unknown>): PowerLoomDb {
  return {
    select: () => ({ from: () => ({ where: async () => [...store.entries()].map(([key, value]) => ({ key, value })) }) }),
    insert: () => ({ values: (row: { key: string; value: unknown }) => ({ onConflictDoUpdate: async () => { store.set(row.key, row.value); } }) }),
  } as unknown as PowerLoomDb;
}

const FEED = "https://nuget.example.com/v3/index.json";

describe("savePackageFeed", () => {
  it("adds a feed under the vault's key and answers the feeds without tokens", async () => {
    const store = new Map<string, unknown>();

    const result = await savePackageFeed(fakeConfigDb(store), "docs", { url: FEED, username: "", token: "pat-1" });

    assert.deepEqual(result, { ok: true, value: [{ url: FEED, username: "", hasToken: true }] });
    assert.deepEqual(store.get("vault:docs:packageFeeds"), { feeds: [{ url: FEED, username: undefined, token: "pat-1" }] });
  });

  it("replaces the feed with the same URL in its place, keeping the saved token when none is given", async () => {
    const store = new Map<string, unknown>([["vault:docs:packageFeeds", { feeds: [{ url: FEED, token: "pat-1" }, { url: "https://other.example.com/", token: "pat-2" }] }]]);

    const result = await savePackageFeed(fakeConfigDb(store), "docs", { url: FEED.toUpperCase(), username: "bob", token: "" });

    assert.equal(result.ok, true);
    assert.deepEqual((await readPackageFeedSettings(fakeConfigDb(store), "docs")).feeds, [{ url: FEED.toUpperCase(), username: "bob", token: "pat-1" }, { url: "https://other.example.com/", token: "pat-2" }]);
  });

  it("refuses a new feed without a token, touching nothing", async () => {
    const store = new Map<string, unknown>();

    const result = await savePackageFeed(fakeConfigDb(store), "docs", { url: FEED, username: "", token: "" });

    assert.deepEqual(result, { ok: false, error: `No token saved for ${FEED} yet: give one.` });
    assert.equal(store.size, 0);
  });
});

describe("removePackageFeed", () => {
  it("drops the feed with the URL and answers the ones left", async () => {
    const store = new Map<string, unknown>([["vault:docs:packageFeeds", { feeds: [{ url: FEED, token: "pat-1" }, { url: "https://other.example.com/", username: "u", token: "pat-2" }] }]]);

    const left = await removePackageFeed(fakeConfigDb(store), "docs", FEED);

    assert.deepEqual(left, [{ url: "https://other.example.com/", username: "u", hasToken: true }]);
    assert.deepEqual(store.get("vault:docs:packageFeeds"), { feeds: [{ url: "https://other.example.com/", username: "u", token: "pat-2" }] });
  });

  it("answers null for a URL no feed has", async () => {
    assert.equal(await removePackageFeed(fakeConfigDb(new Map()), "docs", FEED), null);
  });
});

describe("packageFeedsView", () => {
  it("never carries a token, only whether one is saved", () => {
    const view = packageFeedsView({ feeds: [{ url: FEED, token: "pat" }, { url: "https://x.example.com/", username: "u", token: "" }] });

    assert.deepEqual(view, [{ url: FEED, username: "", hasToken: true }, { url: "https://x.example.com/", username: "u", hasToken: false }]);
    assert.equal(JSON.stringify(view).includes("pat"), false);
  });
});
