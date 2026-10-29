import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PowerLoomDb } from "@powerloom/db";
import { readBuildCommands } from "./buildCommandSettings";
import { feedCredentialOf, feedHostsOf, readPackageFeeds } from "./packageFeeds";

// A database whose `config` table answers every key with the one stored value (none when it is undefined).
function dbWith(value: unknown): PowerLoomDb {
  const rows = value === undefined ? [] : [{ value }];

  return { select: () => ({ from: () => ({ where: async () => rows }) }) } as unknown as PowerLoomDb;
}

describe("package feeds", () => {
  const azure = { url: "https://pkgs.dev.azure.com/acme/_packaging/team/nuget/v3/index.json", token: "pat" };

  it("signs in to the sources under the feed's URL with its token", () => {
    assert.deepEqual(feedCredentialOf(azure), { urlPrefixes: [azure.url], username: "powerloom", password: "pat" });
    assert.equal(feedCredentialOf({ ...azure, username: "build" }).username, "build");
  });

  it("opens an Azure Artifacts feed's hosts and blob storage, any other feed's own host", () => {
    assert.deepEqual(feedHostsOf(azure), ["pkgs.dev.azure.com", "acme.pkgs.visualstudio.com", "*.vsblob.vsassets.io"]);
    assert.deepEqual(feedHostsOf({ url: "https://Acme.pkgs.visualstudio.com/_packaging/team/nuget/v3/index.json", token: "pat" }), ["pkgs.dev.azure.com", "acme.pkgs.visualstudio.com", "*.vsblob.vsassets.io"]);
    assert.deepEqual(feedHostsOf({ url: "https://nuget.example.com/v3/index.json", token: "pat" }), ["nuget.example.com"]);
  });
});

describe("vault settings read for the sandbox", () => {
  it("keeps only feeds with an https URL and a token", async () => {
    const feeds = await readPackageFeeds(dbWith({ feeds: [{ url: "https://nuget.example.com/v3/index.json", token: "pat" }, { url: "http://plain.example.com", token: "pat" }, { url: "https://nuget.example.com/other", token: "" }] }), "vault");

    assert.deepEqual(feeds.map((feed) => feed.url), ["https://nuget.example.com/v3/index.json"]);
    assert.deepEqual(await readPackageFeeds(dbWith(undefined), "vault"), []);
  });

  it("lists every configured build and test command of the vault's repos", async () => {
    const commands = await readBuildCommands(dbWith({ repos: { Shop: { build: "dotnet build Shop.sln", test: "dotnet test Shop.sln" }, Docs: { build: " " } } }), "vault");

    assert.deepEqual(commands, ["dotnet build Shop.sln", "dotnet test Shop.sln"]);
    assert.deepEqual(await readBuildCommands(dbWith(undefined), "vault"), []);
  });
});
