import type { IncomingMessage } from "node:http";
import { HostAllowlist } from "./HostAllowlist";
import { readProxyToken } from "./proxyToken";

/** Which hosts a tunnel request may reach; null asks the client for its pass (407). */
export type RequestAllowlist = (request: IncomingMessage) => HostAllowlist | null;

// With a signing secret, each restore's own pass decides (its vault's hosts), sent as the proxy password.
export function signedAllowlist(secret: string): RequestAllowlist {
  return (request) => {
    const hosts = readProxyToken(secret, passwordOf(request.headers["proxy-authorization"]));

    return hosts ? new HostAllowlist(hosts) : null;
  };
}

// Without one, the same list for every restore (SANDBOX_PACKAGE_HOSTS).
export function fixedAllowlist(list: string): RequestAllowlist {
  const allowlist = HostAllowlist.fromList(list);

  return () => allowlist;
}

function passwordOf(header: string | undefined): string {
  if (!header?.startsWith("Basic ")) {
    return "";
  }

  const credentials = Buffer.from(header.slice("Basic ".length), "base64").toString("utf8");

  return credentials.slice(credentials.indexOf(":") + 1);
}
