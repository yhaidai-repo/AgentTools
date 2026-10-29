import assert from "node:assert/strict";
import { test } from "node:test";
import { HostAllowlist } from "./HostAllowlist";

test("allows exact hosts and every host under a *. domain, nothing else", () => {
  const allowlist = HostAllowlist.fromList("api.nuget.org, *.vsblob.vsassets.io,,");

  assert.equal(allowlist.allows("api.nuget.org"), true);
  assert.equal(allowlist.allows("API.NuGet.org"), true);
  assert.equal(allowlist.allows("store1.vsblob.vsassets.io"), true);
  assert.equal(allowlist.allows("vsblob.vsassets.io"), false);
  assert.equal(allowlist.allows("evil-api.nuget.org"), false);
  assert.equal(allowlist.allows("api.nuget.org.evil.com"), false);
  assert.equal(allowlist.size, 2);
});

test("a *. domain covers hosts several labels deep", () => {
  const allowlist = HostAllowlist.fromList("*.vsblob.vsassets.io");

  assert.equal(allowlist.allows("a.b.vsblob.vsassets.io"), true);
});

test("a * inside a label matches any run of characters within that label", () => {
  const allowlist = HostAllowlist.fromList("*vsblobprod*.blob.core.windows.net");

  assert.equal(allowlist.allows("z7qvsblobprodeus2134.blob.core.windows.net"), true);
  assert.equal(allowlist.allows("Z7QVSBLOBPRODEUS2134.blob.core.windows.net"), true);
  assert.equal(allowlist.allows("vsblobprod.blob.core.windows.net"), true);
  assert.equal(allowlist.allows("evil.blob.core.windows.net"), false);
  assert.equal(allowlist.allows("vsblobprod.example.com"), false);
  assert.equal(allowlist.allows("z7qvsblobprodeus2134.blob.core.windows.net.evil.com"), false);
});

test("a * inside a label does not cross a dot", () => {
  const allowlist = HostAllowlist.fromList("*vsblobprod*.blob.core.windows.net");

  assert.equal(allowlist.allows("evil.vsblobprod.blob.core.windows.net"), false);
  assert.equal(allowlist.allows("vsblobprod.evil.blob.core.windows.net"), false);
});

test("pattern characters other than * match literally", () => {
  const allowlist = HostAllowlist.fromList("api.nuget.org");

  assert.equal(allowlist.allows("apixnuget.org"), false);
});
