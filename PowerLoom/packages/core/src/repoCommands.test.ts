import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PowerLoomDb } from "@powerloom/db";
import { buildCommandsOf, repoCommandProblem, saveRepoCommands } from "./repoCommands";
import { readRepoCommandSettings } from "./settings";

// The config table as one key → value map: what readValue and saveValue reach.
function fakeConfigDb(store: Map<string, unknown>) {
  let saved: { key: string; value: unknown } | null = null;

  return {
    select: () => ({ from: () => ({ where: async () => [...store.entries()].map(([key, value]) => ({ key, value })) }) }),
    insert: () => ({ values: (row: { key: string; value: unknown }) => ({ onConflictDoUpdate: async () => { saved = row; store.set(row.key, row.value); } }) }),
    lastSaved: () => saved,
  } as unknown as PowerLoomDb & { lastSaved(): { key: string; value: unknown } | null };
}

describe("repoCommandProblem", () => {
  it("accepts an empty command, one command with arguments, and a folder change before one", () => {
    for (const command of ["", "   ", "dotnet build Shop.sln -c Release", "dotnet test Shop.sln --no-build --filter Category=Unit", "cd src/Shop.Api && dotnet build", "cd tests && npm test"]) {
      assert.equal(repoCommandProblem(command), null, command);
    }
  });

  it("refuses compounds the shell would not route", () => {
    for (const command of ["dotnet build && dotnet test", "dotnet build; dotnet test", "dotnet test | tail -40", "cd src || exit 1", "cd src && dotnet build && dotnet test", "cd a b && dotnet build", "dotnet build\ndotnet test", "cd src &&"]) {
      assert.match(repoCommandProblem(command) ?? "", /compound/, command);
    }
  });

  it("refuses command substitution", () => {
    assert.match(repoCommandProblem("dotnet test $(cat targets.txt)") ?? "", /substitution/);
    assert.match(repoCommandProblem("echo `dotnet test`") ?? "", /substitution/);
  });
});

describe("saveRepoCommands", () => {
  it("adds the repo's commands under the vault's key, keeping the other repos", async () => {
    const store = new Map<string, unknown>([["vault:docs:repoCommands", { repos: { Other: { build: "make" } } }]]);
    const db = fakeConfigDb(store);

    await saveRepoCommands(db, "docs", "Shop", { build: "dotnet build Shop.sln", test: null });

    assert.equal(db.lastSaved()?.key, "vault:docs:repoCommands");
    assert.deepEqual(await readRepoCommandSettings(db, "docs"), { repos: { Other: { build: "make" }, Shop: { build: "dotnet build Shop.sln" } } });
  });

  it("replaces an entry saved under another case of the name, and drops a repo left without commands", async () => {
    const store = new Map<string, unknown>([["vault:docs:repoCommands", { repos: { shop: { build: "old", test: "old test" } } }]]);
    const db = fakeConfigDb(store);

    await saveRepoCommands(db, "docs", "Shop", { build: null, test: "dotnet test" });
    assert.deepEqual(await readRepoCommandSettings(db, "docs"), { repos: { Shop: { test: "dotnet test" } } });

    await saveRepoCommands(db, "docs", "SHOP", { build: null, test: null });
    assert.deepEqual(await readRepoCommandSettings(db, "docs"), { repos: {} });
  });
});

describe("buildCommandsOf", () => {
  it("finds the repo in any case and answers null for a missing command", () => {
    const settings = { repos: { "Shop-API": { build: "dotnet build" } } };

    assert.deepEqual(buildCommandsOf(settings, "shop-api"), { build: "dotnet build", test: null });
    assert.deepEqual(buildCommandsOf(settings, "Other"), { build: null, test: null });
  });
});
