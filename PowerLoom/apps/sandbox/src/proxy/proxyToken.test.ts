import assert from "node:assert/strict";
import type { IncomingMessage } from "node:http";
import { test } from "node:test";
import { proxyTokenOf, readProxyToken } from "./proxyToken";
import { signedAllowlist } from "./requestAllowlist";

const inAnHour = new Date(Date.now() + 3_600_000);

function requestWith(password: string | null): IncomingMessage {
  const headers = password === null ? {} : { "proxy-authorization": `Basic ${Buffer.from(`restore:${password}`).toString("base64")}` };

  return { headers } as unknown as IncomingMessage;
}

test("a pass opens exactly the hosts it was signed with, until it expires", () => {
  const token = proxyTokenOf("secret", ["api.nuget.org", "*.vsblob.vsassets.io"], inAnHour);

  assert.deepEqual(readProxyToken("secret", token), ["api.nuget.org", "*.vsblob.vsassets.io"]);
  assert.equal(readProxyToken("secret", token, new Date(inAnHour.getTime() + 1_000)), null);
});

test("a changed pass or another secret's pass opens nothing", () => {
  const token = proxyTokenOf("secret", ["api.nuget.org"], inAnHour);
  const [version, , signature] = token.split(".");
  const widened = `${version}.${Buffer.from(JSON.stringify({ h: ["*.com"], e: 9_999_999_999 })).toString("base64url")}.${signature}`;

  assert.equal(readProxyToken("secret", widened), null);
  assert.equal(readProxyToken("other", token), null);
  assert.equal(readProxyToken("secret", "garbage"), null);
});

test("the proxy asks for a pass when a request brings none or a bad one, and follows a good one", () => {
  const allowlistOf = signedAllowlist("secret");
  const good = allowlistOf(requestWith(proxyTokenOf("secret", ["registry.npmjs.org"], inAnHour)));

  assert.equal(allowlistOf(requestWith(null)), null);
  assert.equal(allowlistOf(requestWith("v1.x.y")), null);
  assert.equal(good?.allows("registry.npmjs.org"), true);
  assert.equal(good?.allows("api.nuget.org"), false);
});
