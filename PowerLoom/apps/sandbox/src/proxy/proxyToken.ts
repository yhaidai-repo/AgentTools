import { createHmac, timingSafeEqual } from "node:crypto";

const VERSION = "v1";

// A restore's pass through the egress proxy (phase 3b): the vault's host list and an expiry, signed by the sandbox
// service with the secret it shares with the proxy. The proxy needs no state and no admin API a restore container could
// reach; a pass that is changed, expired or signed with another secret opens nothing.
export function proxyTokenOf(secret: string, hosts: string[], expiresAt: Date): string {
  const payload = Buffer.from(JSON.stringify({ h: hosts, e: Math.floor(expiresAt.getTime() / 1000) }), "utf8").toString("base64url");

  return `${VERSION}.${payload}.${signatureOf(secret, payload)}`;
}

/** The hosts a pass allows, or null when it isn't one the secret signed or it has expired. */
export function readProxyToken(secret: string, token: string, now = new Date()): string[] | null {
  const [version, payload, signature] = token.split(".");

  if (version !== VERSION || !payload || !signature || !sameText(signature, signatureOf(secret, payload))) {
    return null;
  }

  const { h, e } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { h: string[]; e: number };

  return e * 1000 > now.getTime() && Array.isArray(h) ? h : null;
}

function signatureOf(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(`${VERSION}.${payload}`).digest("base64url");
}

function sameText(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);

  return left.length === right.length && timingSafeEqual(left, right);
}
