import assert from "node:assert/strict";
import dns from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import { EventEmitter } from "node:events";
import { Readable } from "node:stream";
import { gzipSync } from "node:zlib";
import { afterEach, it, mock } from "node:test";
import { downloadDocument } from "./documentDownload";
import { isPrivateAddress } from "./publicHost";

afterEach(() => mock.restoreAll());
type Reply = Readable & { headers: Record<string, string>; statusCode: number };
function reply(source: Iterable<Buffer> | AsyncIterable<Buffer>, headers: Record<string, string> = {}, statusCode = 200): Reply {
  return Object.assign(Readable.from(source, { objectMode: false, highWaterMark: 64 * 1024 }), { headers: { "content-type": "application/pdf", ...headers }, statusCode });
}
function transport(answer: (url: URL, options: any) => Reply) {
  let calls = 0;
  const request = (url: URL, options: any, callback: (value: Reply) => void) => {
    calls++;
    const emitter = new EventEmitter();
    return Object.assign(emitter, { end: () => { queueMicrotask(() => callback(answer(url, options))); } });
  };
  mock.method(http, "request", request as any);
  mock.method(https, "request", request as any);
  return () => calls;
}

it("pins the approved DNS address while retaining the original HTTPS hostname", async () => {
  let resolutions = 0;
  mock.method(dns, "lookup", async () => [{ address: ++resolutions === 1 ? "93.184.216.34" : "127.0.0.1", family: 4 }] as any);
  const calls = transport((url, options) => {
    assert.equal(url.hostname, "public.example.invalid");
    assert.equal(url.protocol, "https:");
    assert.equal(options.agent, false);
    assert.equal(options.rejectUnauthorized, undefined);
    assert.equal(options.checkServerIdentity, undefined);
    options.lookup(url.hostname, {}, (error: unknown, address: string, family: number) => {
      assert.equal(error, null);
      assert.equal(address, "93.184.216.34");
      assert.equal(family, 4);
    });
    return reply([Buffer.from("synthetic PDF")]);
  });
  const result = await downloadDocument("https://public.example.invalid/demo.pdf");
  assert.equal(result.ok, true);
  assert.equal(resolutions, 1);
  assert.equal(calls(), 1);
});

it("revalidates every redirect and never connects to an internal redirect target", async () => {
  mock.method(dns, "lookup", async (hostname: string) => [{ address: hostname.startsWith("public") ? "93.184.216.34" : "127.0.0.1", family: 4 }] as any);
  const first = reply([], { location: "http://internal.example.invalid/secret.pdf" }, 302);
  const calls = transport(() => first);
  const result = await downloadDocument("https://public.example.invalid/demo.pdf");
  assert.equal(result.ok, false);
  assert.match(result.ok ? "" : result.error, /isn't on the public web/);
  assert.equal(calls(), 1);
  assert.equal(first.destroyed, true);
});

it("normalizes mapped IPv4 and all link-local IPv6 addresses before classifying", () => {
  for (const address of ["fe81::1", "febf::1", "FE80:0000:0000:0000:0000:0000:0000:0001", "::ffff:7f00:1", "::FFFF:a00:1", "::ffff:c0a8:101", "ff02::1", "2002:7f00:1::", "192.0.2.1", "198.18.1.1", "0.0.0.0", "255.255.255.255", "bad address"]) assert.equal(isPrivateAddress(address), true, address);
  for (const address of ["93.184.216.34", "8.8.8.8", "::ffff:808:808", "2606:4700:4700::1111"]) assert.equal(isPrivateAddress(address), false, address);
});

for (const length of [undefined, "1"]) it(`cancels oversized streams early with declared length ${length}`, async () => {
  mock.method(dns, "lookup", async () => [{ address: "93.184.216.34", family: 4 }] as any);
  let produced = 0;
  const incoming = reply((async function* () { for (let i = 0; i < 100; i++) { produced++; yield Buffer.alloc(1024 * 1024); } })(), length ? { "content-length": length } : {});
  transport(() => incoming);
  const result = await downloadDocument("https://public.example.invalid/demo.pdf");
  assert.equal(result.ok, false);
  assert.match(result.ok ? "" : result.error, /too large/);
  assert.ok(produced < 26, `consumed ${produced} MiB`);
  assert.equal(incoming.destroyed, true);
});

it("limits decoded bytes and returns read failures as outcomes", async () => {
  mock.method(dns, "lookup", async () => [{ address: "93.184.216.34", family: 4 }] as any);
  const compressed = gzipSync(Buffer.alloc(21 * 1024 * 1024));
  let fail = false;
  transport(() => fail
    ? reply((async function* () { yield Buffer.from("partial"); throw new Error("synthetic stream failed"); })())
    : reply([compressed], { "content-encoding": "gzip", "content-length": String(compressed.length) }));
  const large = await downloadDocument("https://public.example.invalid/demo.pdf");
  assert.equal(large.ok, false);
  assert.match(large.ok ? "" : large.error, /too large/);
  fail = true;
  const failed = await downloadDocument("https://public.example.invalid/demo.pdf");
  assert.equal(failed.ok, false);
  assert.match(failed.ok ? "" : failed.error, /synthetic stream failed/);
});
