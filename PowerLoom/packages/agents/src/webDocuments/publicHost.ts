import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

// IPv4 ranges that aren't the public web: this host, private networks, link-local, carrier-grade NAT.
const PRIVATE_V4: [string, number][] = [["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.168.0.0", 16]];

// PowerLoom downloads only what the public web serves: a PBI link to localhost or a private network would reach the
// stack's own services (the database, PowerLoom's API) from inside it.
export async function privateHostProblem(url: URL): Promise<string | null> {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return `${url.protocol} links aren't downloaded`;
  }

  const addresses = await lookup(url.hostname, { all: true }).catch(() => []);

  if (addresses.length === 0) {
    return `${url.hostname} doesn't resolve`;
  }

  const internal = addresses.find((entry) => isPrivateAddress(entry.address));

  return internal ? `${url.hostname} isn't on the public web (${internal.address})` : null;
}

export function isPrivateAddress(address: string): boolean {
  const v4 = address.startsWith("::ffff:") ? address.slice("::ffff:".length) : address;

  if (isIP(v4) === 4) {
    return PRIVATE_V4.some(([prefix, bits]) => inRange(v4, prefix, bits));
  }

  const v6 = address.toLowerCase();

  return v6 === "::1" || v6 === "::" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe80");
}

function inRange(address: string, prefix: string, bits: number): boolean {
  return toNumber(address) >>> (32 - bits) === toNumber(prefix) >>> (32 - bits);
}

function toNumber(address: string): number {
  return address.split(".").reduce((value, part) => ((value << 8) + Number(part)) >>> 0, 0);
}
