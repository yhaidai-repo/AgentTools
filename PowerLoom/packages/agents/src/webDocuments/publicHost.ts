import dns from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import type { LookupAddress } from "node:dns";

const privateAddresses = new BlockList();
for (const [address, bits] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16],
  ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.88.99.0", 24], ["192.168.0.0", 16],
  ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const) privateAddresses.addSubnet(address, bits, "ipv4");
const globalV6 = new BlockList();
globalV6.addSubnet("2000::", 3, "ipv6");
for (const [address, bits] of [["2001::", 23], ["2001:db8::", 32], ["2002::", 16], ["3fff::", 20]] as const) privateAddresses.addSubnet(address, bits, "ipv6");
const mappedV4 = new BlockList();
mappedV4.addSubnet("::ffff:0:0", 96, "ipv6");

// The transport consumes these exact approved addresses without a second DNS resolution.
export async function publicAddresses(url: URL): Promise<LookupAddress[]> {
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error(`${url.protocol} links aren't downloaded`);
  if (url.username || url.password) throw new Error("links with credentials aren't downloaded");
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  const family = isIP(hostname);
  const addresses = family ? [{ address: hostname, family }] : await dns.lookup(hostname, { all: true }).catch(() => []);
  if (!addresses.length) throw new Error(`${hostname} doesn't resolve`);
  const internal = addresses.find(entry => isPrivateAddress(entry.address));
  if (internal) throw new Error(`${hostname} isn't on the public web (${internal.address})`);
  return addresses;
}

export async function privateHostProblem(url: URL): Promise<string | null> {
  try { await publicAddresses(url); return null; }
  catch (error) { return error instanceof Error ? error.message : String(error); }
}

export function isPrivateAddress(address: string): boolean {
  const family = isIP(address);
  if (!family) return true;
  const type = family === 4 ? "ipv4" : "ipv6";
  if (privateAddresses.check(address, type)) return true;
  return family === 6 && !mappedV4.check(address, "ipv6") && !globalV6.check(address, "ipv6");
}
