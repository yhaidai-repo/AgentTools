import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SearxngClient } from "./SearxngClient";
import { WebSearchRequestError } from "./WebSearchRequestError";

function answering(status: number, body: unknown, urls: string[]): typeof fetch {
  return (async (url: string) => {
    urls.push(url);

    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
}

describe("SearxngClient", () => {
  it("asks for JSON in the settings' language and maps results and silent engines", async () => {
    const urls: string[] = [];
    const body = {
      results: [{ title: " HETS 270/271 Companion Guide ", url: "https://www.cms.gov/files/hets.pdf", content: "AAA03 reject reasons" }, { title: "no link" }],
      unresponsive_engines: [["google", "CAPTCHA"], ["bing", "timeout"]],
    };
    const client = new SearxngClient("http://searxng:8080/", answering(200, body, urls));

    const answer = await client.search({ query: "HETS 270 AAA03", language: "uk-UA", freshness: "year" });

    assert.equal(urls[0], "http://searxng:8080/search?q=HETS+270+AAA03&format=json&language=uk-UA&time_range=year");
    assert.deepEqual(answer.hits, [{ title: "HETS 270/271 Companion Guide", url: "https://www.cms.gov/files/hets.pdf", snippet: "AAA03 reject reasons" }]);
    assert.deepEqual(answer.unresponsiveEngines, [{ engine: "google", reason: "CAPTCHA" }, { engine: "bing", reason: "timeout" }]);
  });

  it("names the settings.yml fix when SearXNG refuses JSON", async () => {
    const client = new SearxngClient("http://searxng:8080", answering(403, {}, []));

    await assert.rejects(client.search({ query: "x y", language: "auto", freshness: null }), (error: WebSearchRequestError) => error.status === 403 && /search\.formats/.test(error.message));
  });

  it("turns an unreachable SearXNG into a request error", async () => {
    const down = (async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    const client = new SearxngClient("http://searxng:8080", down);

    await assert.rejects(client.search({ query: "x y", language: "auto", freshness: null }), (error: WebSearchRequestError) => error.status === 0 && /can't be reached: fetch failed/.test(error.message));
  });
});
