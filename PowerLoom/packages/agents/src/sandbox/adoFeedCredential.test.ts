import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { adoFeedCredential, adoFeedHosts } from "./adoFeedCredential";

describe("adoFeedCredential", () => {
  it("covers both Azure Artifacts host names of the vault's organization", () => {
    assert.deepEqual(adoFeedCredential("https://dev.azure.com/acme", "pat")?.urlPrefixes, ["https://pkgs.dev.azure.com/acme/", "https://acme.pkgs.visualstudio.com/"]);
    assert.deepEqual(adoFeedCredential("https://acme.visualstudio.com/", "pat")?.urlPrefixes, ["https://pkgs.dev.azure.com/acme/", "https://acme.pkgs.visualstudio.com/"]);
  });

  it("names the hosts a restore of the organization's feeds reaches", () => {
    assert.deepEqual(adoFeedHosts("https://dev.azure.com/Acme"), ["pkgs.dev.azure.com", "acme.pkgs.visualstudio.com", "*.vsblob.vsassets.io"]);
    assert.deepEqual(adoFeedHosts("https://example.com"), []);
  });

  it("gives nothing without an organization or a token", () => {
    assert.equal(adoFeedCredential("https://example.com", "pat"), null);
    assert.equal(adoFeedCredential("https://dev.azure.com/acme", ""), null);
  });
});
