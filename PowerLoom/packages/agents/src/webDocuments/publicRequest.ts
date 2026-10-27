import http from "node:http";
import https from "node:https";
import type { LookupAddress } from "node:dns";
import { Readable } from "node:stream";
import { createBrotliDecompress, createGunzip, createInflate } from "node:zlib";

// Keep the URL hostname for Host and HTTPS certificate verification, but connect only to an approved address.
export function publicRequest(target: URL, addresses: LookupAddress[], signal: AbortSignal): Promise<Response> {
  return new Promise((resolve, reject) => {
    const address = addresses[0];
    if (!address) return reject(new Error("no approved public address"));
    const transport = target.protocol === "https:" ? https : http;
    const request = transport.request(target, {
      agent: false, family: address.family, signal,
      lookup: (_hostname, _options, callback) => callback(null, address.address, address.family),
      headers: { "user-agent": "Mozilla/5.0 (compatible; PowerLoom document reader)", "accept-encoding": "gzip, deflate, br" },
    }, incoming => {
      const headers = new Headers();
      for (const [key, value] of Object.entries(incoming.headers)) if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(", ") : value);
      const encoding = headers.get("content-encoding")?.toLowerCase();
      const decoder = encoding === "gzip" ? createGunzip() : encoding === "deflate" ? createInflate() : encoding === "br" ? createBrotliDecompress() : null;
      if (encoding && encoding !== "identity" && !decoder) { incoming.destroy(); reject(new Error(`unsupported content encoding: ${encoding}`)); return; }
      const body = decoder ? incoming.pipe(decoder) : incoming;
      if (decoder) {
        incoming.on("error", error => decoder.destroy(error));
        decoder.on("close", () => incoming.destroy());
      }
      const status = incoming.statusCode ?? 502;
      if ([204, 205, 304].includes(status)) incoming.destroy();
      resolve(new Response([204, 205, 304].includes(status) ? null : Readable.toWeb(body, { strategy: { highWaterMark: 64 * 1024, size: chunk => chunk.byteLength } }) as ReadableStream<Uint8Array>, { status, headers }));
    });
    request.on("error", reject);
    request.end();
  });
}
