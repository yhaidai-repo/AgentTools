import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NotSignedInError, type AzureUserLogin } from "@powerloom/azure";
import { azureTokenAnswer } from "./azureTokenAnswer";

const SECRET = "the-shim-secret";
const URL_OF_SHIM = new URL("http://runner/azure/token?vault=work&resource=https://management.azure.com");
const TOKEN = { accessToken: "eyJ.token", expiresOn: "2026-10-25 12:00:00.000000" };

function loginWith(token: (vault: string) => Promise<object>): AzureUserLogin & { asked: number } {
  const login = { asked: 0, token: async (vault: string) => { login.asked++; return token(vault); } };

  return login as unknown as AzureUserLogin & { asked: number };
}

describe("the az shim's token route", () => {
  it("answers the shim, which sends the secret, with the vault's token", async () => {
    const answer = await azureTokenAnswer(loginWith(async () => TOKEN), URL_OF_SHIM, `Bearer ${SECRET}`, SECRET);

    assert.deepEqual(answer, { status: 200, body: TOKEN });
  });

  for (const [caller, authorization] of [["without a header", undefined], ["with another secret", "Bearer guess"], ["with the bare secret", SECRET], ["with an empty bearer", "Bearer "]] as const) {
    it(`refuses a caller ${caller} before reading any sign-in`, async () => {
      const login = loginWith(async () => TOKEN);
      const answer = await azureTokenAnswer(login, URL_OF_SHIM, authorization, SECRET);

      assert.equal(answer.status, 403);
      assert.equal(login.asked, 0);
      assert.doesNotMatch(JSON.stringify(answer.body), /eyJ/);
    });
  }

  it("refuses everyone when the host has no secret", async () => {
    const answer = await azureTokenAnswer(loginWith(async () => TOKEN), URL_OF_SHIM, "Bearer ", "");

    assert.equal(answer.status, 403);
  });

  it("answers the shim 401 when nobody signed in, so az reads it as signed out", async () => {
    const answer = await azureTokenAnswer(loginWith(async (vault) => { throw new NotSignedInError(vault); }), URL_OF_SHIM, `Bearer ${SECRET}`, SECRET);

    assert.equal(answer.status, 401);
  });
});
