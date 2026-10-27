import assert from "node:assert/strict";
import { afterEach, it, mock } from "node:test";
import { AdoClient } from "./AdoClient";

afterEach(() => mock.restoreAll());
const client = new AdoClient({ orgUrl: "https://dev.azure.com/synthetic", project: "demo", team: "demo", pat: "synthetic" });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

it("reads file 2,001 and filters folders on every changes page", async () => {
  const urls: URL[] = [];
  mock.method(globalThis, "fetch", async (url: string) => {
    urls.push(new URL(url));
    return urls.length === 1
      ? json({ changeEntries: Array.from({ length: 2000 }, (_, i) => ({ item: { path: `/file${i}` }, changeType: "edit" })), nextSkip: 2000, nextTop: 2000 })
      : json({ changeEntries: [{ item: { path: "/file2000" }, changeType: "add" }, { item: { path: "/folder", isFolder: true } }], nextSkip: 0, nextTop: 0 });
  });
  const changes = await client.getPullRequestChanges("repo", 1, 1);
  assert.equal(changes.length, 2001);
  assert.equal(changes.at(-1)?.path, "/file2000");
  assert.equal(urls[1].searchParams.get("$skip"), "2000");
});

it("rejects later-page errors and invalid continuations without returning a partial file list", async () => {
  let calls = 0;
  const replacement = mock.method(globalThis, "fetch", async () => ++calls === 1 ? json({ changeEntries: [], nextSkip: 2000, nextTop: 2000 }) : json({ message: "synthetic page failure" }, 503));
  await assert.rejects(client.getPullRequestChanges("repo", 1, 1), /synthetic page failure/);
  replacement.mock.mockImplementation(async () => json({ changeEntries: [], nextSkip: 0, nextTop: 2000 }));
  await assert.rejects(client.getPullRequestChanges("repo", 1, 1), /invalid changes pagination/);
});

it("forwards cancellation and stops before fetching the next page", async () => {
  const controller = new AbortController();
  let calls = 0;
  mock.method(globalThis, "fetch", async (_url: string, options: RequestInit) => {
    calls++;
    assert.equal(options.signal, controller.signal);
    controller.abort();
    return json({ changeEntries: [], nextSkip: 2000, nextTop: 2000 });
  });
  await assert.rejects(client.getPullRequestChanges("repo", 1, 1, controller.signal), /aborted/);
  assert.equal(calls, 1);
});
