import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PowerLoomDb } from "@powerloom/db";
import { normalizePackageHosts, packageHostProblem, packageHostsProblem, saveSandboxSettings } from "./sandboxSettings";
import { readSandboxSettings } from "./settings";

// The config table as one key → value map: what readValue and saveValue reach.
function fakeConfigDb(store: Map<string, unknown>): PowerLoomDb {
  return {
    select: () => ({ from: () => ({ where: async () => [...store.entries()].map(([key, value]) => ({ key, value })) }) }),
    insert: () => ({ values: (row: { key: string; value: unknown }) => ({ onConflictDoUpdate: async () => { store.set(row.key, row.value); } }) }),
  } as unknown as PowerLoomDb;
}

describe("packageHostProblem", () => {
  it("accepts what the egress proxy's allowlist matches", () => {
    for (const host of ["api.nuget.org", "*.example.com", "cdn-*.example.com", "*.blob.core.windows.net", "pkgs.dev.azure.com", "a-b.c-d.io"]) {
      assert.equal(packageHostProblem(host), null, host);
    }
  });

  it("refuses a scheme, a path, a port or whitespace", () => {
    assert.match(packageHostProblem("https://api.nuget.org") ?? "", /scheme or a path/);
    assert.match(packageHostProblem("api.nuget.org/v3/index.json") ?? "", /scheme or a path/);
    assert.match(packageHostProblem("api.nuget.org:443") ?? "", /port/);
    assert.match(packageHostProblem("api nuget.org") ?? "", /whitespace/);
  });

  it("refuses what is not a host name, and a pattern that would allow every host", () => {
    for (const entry of ["nuget", ".example.com", "example..com", "-bad.example.com", "ex_ample.com", "*"]) {
      assert.match(packageHostProblem(entry) ?? "", /Not a host name/, entry);
    }

    assert.match(packageHostProblem("*.*") ?? "", /every host/);
  });
});

describe("normalizePackageHosts", () => {
  it("trims, lower-cases, drops empties and repeats, keeps the order", () => {
    assert.deepEqual(normalizePackageHosts([" API.nuget.org ", "", "registry.npmjs.org", "api.nuget.org", "  "]), ["api.nuget.org", "registry.npmjs.org"]);
  });
});

describe("packageHostsProblem", () => {
  it("names the first bad entry", () => {
    assert.match(packageHostsProblem(["api.nuget.org", "http://x.y", "nope"]) ?? "", /http:\/\/x\.y/);
  });

  it("bounds the list", () => {
    const hosts = Array.from({ length: 51 }, (_, index) => `host${index}.example.com`);

    assert.equal(packageHostsProblem(hosts.slice(0, 50)), null);
    assert.match(packageHostsProblem(hosts) ?? "", /At most 50/);
  });
});

describe("saveSandboxSettings", () => {
  it("saves under the vault's key, where readSandboxSettings reads it", async () => {
    const store = new Map<string, unknown>();
    const db = fakeConfigDb(store);

    await saveSandboxSettings(db, "docs", { packageHosts: ["api.nuget.org", "*.example.com"], image: "dotnet" });

    assert.deepEqual(store.get("vault:docs:sandbox"), { packageHosts: ["api.nuget.org", "*.example.com"], image: "dotnet" });
    assert.deepEqual(await readSandboxSettings(db, "docs"), { packageHosts: ["api.nuget.org", "*.example.com"], image: "dotnet" });
  });
});
