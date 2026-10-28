import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { connect, type Socket } from "node:net";
import type { RequestAllowlist } from "./requestAllowlist";

const HTTPS_PORT = 443;
const CONNECT_TIMEOUT_MS = 30_000;
// A client sends its pass only after the proxy asks (.NET's HttpClient does).
const ASK_FOR_PASS = "HTTP/1.1 407 Proxy Authentication Required\r\nProxy-Authenticate: Basic realm=\"powerloom-sandbox\"\r\n\r\n";

// The restore containers' only way out (design agent-sandbox, phase 3): HTTPS tunnels (CONNECT) to allowed hosts on
// port 443, nothing else. It sees host names only, never the traffic, so a feed's token passes through it encrypted.
// Every tunnel, allowed or refused, is logged with the client's address. Which hosts a tunnel may reach comes from the
// request (a restore's signed pass) or from one fixed list.
export class EgressProxy {
  private readonly server: Server;

  constructor(private readonly allowlistOf: RequestAllowlist) {
    this.server = createServer((request, response) => refusePlainHttp(request, response));
    this.server.on("connect", (request: IncomingMessage, client: Socket, head: Buffer) => this.tunnel(request, client, head));
  }

  listen(port: number): void {
    this.server.listen(port);
  }

  close(): Promise<void> {
    return new Promise((resolve) => this.server.close(() => resolve()));
  }

  private tunnel(request: IncomingMessage, client: Socket, head: Buffer): void {
    const { host, port } = targetOf(request.url ?? "");
    const from = client.remoteAddress ?? "unknown";
    const allowlist = this.allowlistOf(request);

    if (!allowlist) {
      console.log(`asked ${from} for a pass to ${host}:${port}`);
      client.end(ASK_FOR_PASS);

      return;
    }

    if (port !== HTTPS_PORT || !allowlist.allows(host)) {
      console.log(`refused ${host}:${port} for ${from}`);
      client.end(`HTTP/1.1 403 Forbidden\r\n\r\n${host}:${port} is not one of the vault's package hosts (Settings → Data access → Sandbox)\r\n`);

      return;
    }

    console.log(`tunnel ${host}:${port} for ${from}`);
    this.open(host, port, client, head);
  }

  private open(host: string, port: number, client: Socket, head: Buffer): void {
    const upstream = connect({ host, port, timeout: CONNECT_TIMEOUT_MS }, () => {
      client.write("HTTP/1.1 200 Connection Established\r\n\r\n");
      upstream.write(head);
      upstream.pipe(client);
      client.pipe(upstream);
    });

    upstream.on("timeout", () => upstream.destroy(new Error("timed out")));
    upstream.on("error", (error) => client.end(`HTTP/1.1 502 Bad Gateway\r\n\r\n${error.message}\r\n`));
    client.on("error", () => upstream.destroy());
  }
}

function targetOf(url: string): { host: string; port: number } {
  const separator = url.lastIndexOf(":");

  return separator < 0 ? { host: url, port: HTTPS_PORT } : { host: url.slice(0, separator).replace(/^\[|\]$/g, ""), port: Number(url.slice(separator + 1)) };
}

// Plain HTTP would let the proxy see (and the client send) a token in the clear: only tunnels are served.
function refusePlainHttp(request: IncomingMessage, response: ServerResponse): void {
  console.log(`refused plain HTTP ${request.method} ${request.url} for ${request.socket.remoteAddress ?? "unknown"}`);
  response.writeHead(403, { "Content-Type": "text/plain" });
  response.end("Only HTTPS (CONNECT) to an allowed package host is served.\n");
}
