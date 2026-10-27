import assert from "node:assert/strict";
import { afterEach, it, mock } from "node:test";
import { ConfluenceClient } from "./ConfluenceClient";

afterEach(() => mock.restoreAll());
const site = "https://trusted.example.invalid";
const page = `${site}/wiki/spaces/D/pages/123/demo`;
const client = new ConfluenceClient({ site, email: "synthetic", apiToken: "synthetic" });
const file = (downloadUrl: string) => ({ id: "1", fileName: "demo.txt", mediaType: "text/plain", sizeBytes: 4, downloadUrl });
const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });

it("rejects foreign origins and HTTP before every authenticated entry path", async () => {
  let requests = 0;
  mock.method(globalThis, "fetch", async () => { requests++; return json({}); });
  for (const target of ["https://foreign.example.invalid/wiki/pages/123", "http://trusted.example.invalid/wiki/pages/123"]) {
    await assert.rejects(client.page(target), /trusted HTTPS/);
    await assert.rejects(client.files(target), /trusted HTTPS/);
    await assert.rejects(client.search(target, "test", null), /trusted HTTPS/);
    await assert.rejects(client.download(file(target)), /trusted HTTPS/);
  }
  assert.equal(requests, 0);
  assert.equal(ConfluenceClient.fromEnv({ CONFLUENCE_EMAIL: "synthetic", CONFLUENCE_API_TOKEN: "synthetic" }), null);
});

it("authenticates configured pages and all attachment pages, with compatible download links", async () => {
  const urls: string[] = [];
  mock.method(globalThis, "fetch", async (url: URL, options: RequestInit) => {
    urls.push(String(url));
    assert.equal(url.origin, site);
    assert.equal(options.redirect, "manual");
    assert.match((options.headers as Record<string, string>).Authorization, /^Basic /);
    if (url.pathname.endsWith("/attachments")) return json({ results: [{ id: "1", title: "one", mediaType: "text/plain", fileSize: 4, downloadLink: "/download/attachments/123/one" }], _links: { next: "/wiki/next" } });
    if (url.pathname === "/wiki/next") return json({ results: [{ id: "2", title: "two", mediaType: "text/plain", fileSize: 4, downloadLink: "/download/attachments/123/two" }] });
    return json({ id: "123", title: "Demo", version: { number: 1 } });
  });
  assert.equal((await client.page(page)).title, "Demo");
  const files = await client.files(page);
  assert.equal(files.length, 2);
  assert.equal(files[0].downloadUrl, `${site}/wiki/download/attachments/123/one`);
  assert.equal(urls.length, 3);
});

it("validates every redirect and continuation before forwarding credentials", async () => {
  let requests = 0;
  const method = mock.method(globalThis, "fetch", async () => { requests++; return new Response(null, { status: 302, headers: { location: "https://foreign.example.invalid/capture" } }); });
  await assert.rejects(client.page(page), /trusted HTTPS/);
  await assert.rejects(client.download(file(`${site}/wiki/file`)), /trusted HTTPS/);
  assert.equal(requests, 2);
  method.mock.mockImplementation(async () => { requests++; return json({ results: [], _links: { next: "https://foreign.example.invalid/capture" } }); });
  await assert.rejects(client.files(page), /trusted HTTPS/);
  assert.equal(requests, 3);
});

it("follows trusted redirects and propagates later-page failures", async () => {
  let calls = 0;
  const method = mock.method(globalThis, "fetch", async () => ++calls === 1 ? new Response(null, { status: 307, headers: { location: "/wiki/final" } }) : new Response("demo"));
  assert.equal((await client.download(file(`${site}/wiki/file`))).bytes.toString(), "demo");
  calls = 0;
  method.mock.mockImplementation(async () => ++calls === 1 ? json({ results: [], _links: { next: "/wiki/next" } }) : new Response("failed", { status: 503 }));
  await assert.rejects(client.files(page), /503/);
});
