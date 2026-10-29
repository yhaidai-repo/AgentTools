import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { config, repo } from "@powerloom/db";
import type { CommandContext } from "../models/CommandContext";
import { runCommand } from "./runCommand";
import { saveRepoCommandsCommand } from "./saveRepoCommandsCommand";

// The repo table answers the catalogue rows given; the config table is one key → value map.
function fakeDb(repos: { name: string }[], store: Map<string, unknown>) {
  const rowsOf = (table: unknown) => (table === repo ? repos : [...store.entries()].map(([key, value]) => ({ key, value })));

  return {
    select: () => ({ from: (table: unknown) => ({ where: async () => rowsOf(table) }) }),
    insert: () => ({ values: (row: { key: string; value: unknown }) => ({ onConflictDoUpdate: async () => { store.set(row.key, row.value); } }) }),
  };
}

function contextOf(repos: { name: string }[], store: Map<string, unknown>): CommandContext {
  return { db: fakeDb(repos, store) } as unknown as CommandContext;
}

describe("repo.saveCommands", () => {
  it("saves under the catalogue's spelling of the name and answers the saved commands", async () => {
    const store = new Map<string, unknown>();
    const input = { vault: "docs", repo: "shop-api", build: " dotnet build Shop.sln ", test: "" };

    const result = await runCommand(saveRepoCommandsCommand, contextOf([{ name: "Shop-API" }], store), input);

    assert.deepEqual(result, { ok: true, value: { repo: "Shop-API", build: "dotnet build Shop.sln", test: null } });
    assert.deepEqual(store.get("vault:docs:repoCommands"), { repos: { "Shop-API": { build: "dotnet build Shop.sln" } } });
  });

  it("refuses a repo the catalogue doesn't list", async () => {
    const result = await runCommand(saveRepoCommandsCommand, contextOf([], new Map()), { vault: "docs", repo: "Nowhere", build: "make", test: "" });

    assert.equal(result.ok, false);
    assert.match(result.ok ? "" : result.error, /No repo Nowhere/);
  });

  it("refuses a compound command before touching the settings", async () => {
    const store = new Map<string, unknown>();
    const result = await runCommand(saveRepoCommandsCommand, contextOf([{ name: "Shop" }], store), { vault: "docs", repo: "Shop", build: "dotnet build && dotnet test", test: "" });

    assert.equal(result.ok, false);
    assert.match(result.ok ? "" : result.error, /compound/);
    assert.equal(store.size, 0);
  });
});
