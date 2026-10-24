import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { documentSlug, downloadDocument } from "./documentDownload";
import { isPrivateAddress } from "./publicHost";

describe("document download", () => {
  it("refuses this host and private networks, and lets the public web through", () => {
    const blocked = ["127.0.0.1", "10.1.2.3", "172.20.0.5", "192.168.1.10", "169.254.169.254", "100.64.0.1", "::1", "fd00::1", "::ffff:10.0.0.1"];
    const allowed = ["104.18.10.34", "172.32.0.1", "8.8.8.8", "2606:4700::6810:a22"];

    assert.deepEqual(blocked.filter((address) => !isPrivateAddress(address)), []);
    assert.deepEqual(allowed.filter(isPrivateAddress), []);
  });

  it("never downloads from a link to the stack itself", async () => {
    const result = await downloadDocument("http://localhost:5180/api/tasks");

    assert.equal(result.ok, false);
    assert.match(result.ok ? "" : result.error, /isn't on the public web/);
  });

  it("names the file after the link's last part", () => {
    assert.equal(documentSlug("https://www.cms.gov/files/document/hets2026-4-hets-270-271-release-summary.pdf"), "hets2026-4-hets-270-271-release-summary");
    assert.equal(documentSlug("https://example.org/"), "example.org");
  });
});
