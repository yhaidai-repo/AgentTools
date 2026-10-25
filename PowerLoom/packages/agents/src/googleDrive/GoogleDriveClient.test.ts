import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DriveRequestError } from "./DriveRequestError";
import { GoogleDriveClient, quote } from "./GoogleDriveClient";

const options = { clientId: "id", clientSecret: "secret", refreshToken: "refresh" };

function fakeFetch(calls: string[], tokenStatus = 200): typeof fetch {
  return (async (url: string) => {
    calls.push(url);

    if (url.includes("oauth2")) {
      return new Response(JSON.stringify({ access_token: "access", expires_in: 3600 }), { status: tokenStatus });
    }

    return new Response(JSON.stringify({ files: [{ id: "f1", name: "Plan", mimeType: "text/plain", parents: ["p1"] }] }));
  }) as typeof fetch;
}

describe("GoogleDriveClient", () => {
  it("buys one access token for many calls and searches inside the given folders", async () => {
    const calls: string[] = [];
    const client = new GoogleDriveClient(options, fakeFetch(calls));

    await client.search(["p1"], "it's", 10);
    const found = await client.search(["p1", "p2"], "plan", 10);

    assert.equal(calls.filter((url) => url.includes("oauth2")).length, 1);
    assert.match(decodeURIComponent(calls[1]), /\('p1' in parents\) and trashed = false and \(name contains 'it\\'s' or fullText contains 'it\\'s'\)/);
    assert.deepEqual(found.map((file) => file.id), ["f1"]);
  });

  it("counts a revoked sign-in as denied", async () => {
    const client = new GoogleDriveClient(options, fakeFetch([], 400));

    await assert.rejects(client.get("f1"), (error: DriveRequestError) => error.isDenied);
  });

  it("escapes quotes and backslashes in a query", () => {
    assert.equal(quote("a'b\\c"), "'a\\'b\\\\c'");
  });
});
