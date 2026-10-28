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
