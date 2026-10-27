import assert from "node:assert/strict";
import { it, mock } from "node:test";
import { PublicClientApplication } from "@azure/msal-node";
import { AzureUserLogin } from "./AzureUserLogin";
import { NotSignedInError } from "./models/NotSignedInError";
import type { AzureTokenCacheStore } from "./models/AzureTokenCacheStore";

it("clears a warmed MSAL cache when another login instance signs out of the shared store", async () => {
  const account = { home_account_id: "test.test", environment: "login.windows.net", realm: "test", local_account_id: "test", username: "synthetic@example.invalid", authority_type: "MSSTS" };
  let blob: string | null = JSON.stringify({ Account: { "test.test-login.windows.net-test": account } });
  const store: AzureTokenCacheStore = {
    read: async () => blob,
    write: async (_vault, value) => { blob = value; },
    clear: async () => { blob = null; },
    saveAccount: async () => {},
  };
  const reader = new AzureUserLogin(store);
  const writer = new AzureUserLogin(store);
  const acquire = mock.method(PublicClientApplication.prototype, "acquireTokenSilent", async () => { throw new Error("must not acquire a token or use the network"); });
  try {
    assert.ok(await reader.signedInAs("test"));
    await writer.signOut("test");
    assert.equal(blob, null);
    assert.equal(await reader.signedInAs("test"), null);
    await assert.rejects(reader.token("test", "https://management.azure.com", null), NotSignedInError);
    assert.equal(acquire.mock.callCount(), 0);
  } finally {
    acquire.mock.restore();
  }
});
