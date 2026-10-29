import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CommandContext } from "../models/CommandContext";
import { removePackageFeedCommand } from "./removePackageFeedCommand";
import { runCommand } from "./runCommand";
import { savePackageFeedCommand } from "./savePackageFeedCommand";
import { saveSandboxSettingsCommand } from "./saveSandboxSettingsCommand";

// The config table as one key → value map.
function contextOf(store: Map<string, unknown>): CommandContext {
  const db = {
    select: () => ({ from: () => ({ where: async () => [...store.entries()].map(([key, value]) => ({ key, value })) }) }),
    insert: () => ({ values: (row: { key: string; value: unknown }) => ({ onConflictDoUpdate: async () => { store.set(row.key, row.value); } }) }),
  };

  return { db } as unknown as CommandContext;
}

describe("sandbox.saveSettings", () => {
  it("saves the normalized host list and keeps the saved image when none is given", async () => {
    const store = new Map<string, unknown>([["vault:docs:sandbox", { packageHosts: ["api.nuget.org"], image: "dotnet" }]]);

    const result = await runCommand(saveSandboxSettingsCommand, contextOf(store), { vault: "docs", packageHosts: [" API.nuget.org", "*.Example.com", "api.nuget.org", ""] });

    assert.deepEqual(result, { ok: true, value: { packageHosts: ["api.nuget.org", "*.example.com"], image: "dotnet" } });
    assert.deepEqual(store.get("vault:docs:sandbox"), { packageHosts: ["api.nuget.org", "*.example.com"], image: "dotnet" });
  });

  it("sets the image, empty for the default", async () => {
    const store = new Map<string, unknown>([["vault:docs:sandbox", { packageHosts: [], image: "dotnet" }]]);

    const result = await runCommand(saveSandboxSettingsCommand, contextOf(store), { vault: "docs", packageHosts: ["api.nuget.org"], image: "" });

    assert.deepEqual(result, { ok: true, value: { packageHosts: ["api.nuget.org"], image: "" } });
  });

  it("refuses a host with a scheme, and an image that is not a catalog name, before touching the settings", async () => {
    const store = new Map<string, unknown>();
    const badHost = await runCommand(saveSandboxSettingsCommand, contextOf(store), { vault: "docs", packageHosts: ["https://api.nuget.org"] });
    const badImage = await runCommand(saveSandboxSettingsCommand, contextOf(store), { vault: "docs", packageHosts: [], image: "Not An Image" });

    assert.equal(badHost.ok, false);
    assert.match(badHost.ok ? "" : badHost.error, /scheme or a path/);
    assert.equal(badImage.ok, false);
    assert.match(badImage.ok ? "" : badImage.error, /image name/);
    assert.equal(store.size, 0);
  });
});

describe("sandbox.savePackageFeed and sandbox.removePackageFeed", () => {
  it("adds a feed and answers the list without the token, then removes it", async () => {
    const store = new Map<string, unknown>();
    const context = contextOf(store);
    const feed = { vault: "docs", url: "https://nuget.example.com/v3/index.json", username: "", token: "pat-1" };

    const saved = await runCommand(savePackageFeedCommand, context, feed);
    const removed = await runCommand(removePackageFeedCommand, context, { vault: "docs", url: feed.url });

    assert.deepEqual(saved, { ok: true, value: [{ url: feed.url, username: "", hasToken: true }] });
    assert.deepEqual(removed, { ok: true, value: [] });
  });

  it("refuses a feed that is not https, and removing one the vault has not", async () => {
    const context = contextOf(new Map());

    const plain = await runCommand(savePackageFeedCommand, context, { vault: "docs", url: "http://nuget.example.com/", token: "pat" });
    const missing = await runCommand(removePackageFeedCommand, context, { vault: "docs", url: "https://nowhere.example.com/" });

    assert.equal(plain.ok, false);
    assert.match(plain.ok ? "" : plain.error, /https/);
    assert.equal(missing.ok, false);
    assert.match(missing.ok ? "" : missing.error, /No package feed/);
  });
});
