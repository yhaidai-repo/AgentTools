import dns from "node:dns";

// The runner's container has no IPv6 route, and musl's getaddrinfo answers some hosts (login.microsoftonline.com) with
// IPv6 addresses only, so every connect to them failed with ENETUNREACH (2026-10-12). Every lookup asks for IPv4 only;
// Node's net, http and fetch take the default lookup from this module at call time.
const lookup = dns.lookup.bind(dns);
const promisedLookup = dns.promises.lookup.bind(dns.promises);

type LookupOptions = dns.LookupOptions | number | undefined;

function ipv4Options(options: LookupOptions): dns.LookupOptions {
  const given = typeof options === "object" && options !== null ? options : {};

  return { ...given, family: 4 };
}

function preferIpv4(): void {
  (dns as { lookup: unknown }).lookup = (hostname: string, options: LookupOptions | dns.LookupOneOptions | ((...args: unknown[]) => void), callback?: (...args: unknown[]) => void) => {
    if (typeof options === "function") {
      return lookup(hostname, { family: 4 }, options as never);
    }

    return lookup(hostname, ipv4Options(options) as never, callback as never);
  };

  (dns.promises as { lookup: unknown }).lookup = (hostname: string, options?: LookupOptions) => promisedLookup(hostname, ipv4Options(options) as never);
}

preferIpv4();
