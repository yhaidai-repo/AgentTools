import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DevHubClient } from "./DevHubClient";

function clientAnswering(status: number, body: string, seen: { url?: string; init?: RequestInit } = {}) {
  const fetcher = async (url: string | URL | Request, init?: RequestInit) => {
    seen.url = String(url);
    seen.init = init;

    return new Response(body || null, { status });
  };

  return new DevHubClient("http://devhub:1", "secret", fetcher as typeof fetch);
}

describe("DevHubClient", () => {
  it("sends the token and the start request as JSON", async () => {
    const seen: { url?: string; init?: RequestInit } = {};
    const client = clientAnswering(202, "", seen);

    const answer = await client.start({ services: ["signals"], owner: "powerloom-run-7" });

    assert.deepEqual(answer, { ok: true, value: null });
    assert.equal(seen.url, "http://devhub:1/stack");
    assert.equal((seen.init?.headers as Record<string, string>).Authorization, "Bearer secret");
    assert.equal(seen.init?.body, JSON.stringify({ services: ["signals"], owner: "powerloom-run-7" }));
  });

  it("opens a browser case and closes it as its owner", async () => {
    const seen: { url?: string; init?: RequestInit } = {};
    const client = clientAnswering(200, JSON.stringify({ url: "http://127.0.0.1:47811/ui/", title: "DevHub", snapshot: "- heading \"DevHub\"", snapshotCut: false }), seen);

    const opened = await client.openBrowser({ owner: "powerloom-run-7", case: "login", url: "http://127.0.0.1:47811/ui/" });

    assert.equal(opened.ok && opened.value.title, "DevHub");
    assert.equal(seen.url, "http://devhub:1/browser");

    await client.closeBrowser("powerloom-run-7");

    assert.equal(seen.url, "http://devhub:1/browser?owner=powerloom-run-7");
    assert.equal(seen.init?.method, "DELETE");
  });

  it("marks a refused token as denied", async () => {
    const answer = await clientAnswering(401, "").status();

    assert.equal(answer.ok, false);
    assert.equal(!answer.ok && answer.denied, true);
  });

  it("gives the problem's detail for a refused request", async () => {
    const answer = await clientAnswering(409, JSON.stringify({ title: "Conflict", detail: "A local stack is running." })).start({ services: ["signals"], owner: "x" });

    assert.deepEqual(answer, { ok: false, message: "A local stack is running.", denied: false });
  });

  it("says how to start DevHub when it doesn't answer", async () => {
    const failing = (async () => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch;

    const answer = await new DevHubClient("http://devhub:1", "secret", failing).services();

    assert.equal(answer.ok, false);
    assert.match(!answer.ok ? answer.message : "", /Start-DevHub\.ps1/);
  });

  it("escapes the owner in the stop call", async () => {
    const seen: { url?: string; init?: RequestInit } = {};

    await clientAnswering(200, JSON.stringify({ output: [] }), seen).stop("run 7");

    assert.equal(seen.url, "http://devhub:1/stack?owner=run%207");
    assert.equal(seen.init?.method, "DELETE");
  });
});
