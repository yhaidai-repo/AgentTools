import assert from "node:assert/strict";
import { once } from "node:events";
import { request as httpRequest, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { describe, it, mock } from "node:test";
import { PgDialect } from "drizzle-orm/pg-core";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { AGENT_DEFAULTS, CHAT_AGENT_ID } from "@powerloom/agents";
import type { AzureUserLogin } from "@powerloom/azure";
import { ChatSessions } from "./ChatSessions";
import { McpHttpServer } from "./McpHttpServer";
import type { ChatHost } from "./models/ChatHost";

const INITIALIZE = { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "test", version: "1" } } };
const HEADERS = { authorization: "Bearer test", "content-type": "application/json", accept: "application/json, text/event-stream" };
const chat = AGENT_DEFAULTS.find((agent) => agent.id === CHAT_AGENT_ID)!;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

async function fixture(config: () => Promise<typeof chat | undefined> = async () => chat) {
  let allocations = 0;
  let cleanups = 0;
  const cleaned = deferred<void>();
  const log = { record: async () => {} };
  const deps = {
    db: {}, docsRoot: "/unused", docsExclude: [], docUsageLog: null,
    accessLog: log, outside: { log }, sql: null, confluence: null, azure: null, devHub: null, ado: null,
    config: { get: config },
  };
  const host = {
    db: { execute: async () => undefined, insert: () => ({ values: () => ({ onConflictDoUpdate: async () => {} }) }) },
    deps: { forVault: async () => { allocations++; return deps; }, closeAzure: async () => { cleanups++; cleaned.resolve(); } },
  } as unknown as ChatHost;
  const sessions = new ChatSessions(host);
  const http = new McpHttpServer({ token: "test", sessions, azureLogin: {} as AzureUserLogin, azureTokenSecret: "test-only", vaults: async () => ["test"] });
  const server = (http as unknown as { server: Server }).server;
  const disconnected = deferred<void>();
  server.on("request", (_request, response) => response.once("close", () => disconnected.resolve()));
  http.listen(0);
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const url = `http://127.0.0.1:${address.port}/mcp`;
  return {
    sessions, host, url, cleaned: cleaned.promise, disconnected: disconnected.promise,
    allocations: () => allocations, cleanups: () => cleanups,
    initialize: (headers = HEADERS) => fetch(url, { method: "POST", headers, body: JSON.stringify(INITIALIZE) }),
    close: async () => { await sessions.closeAll(); await http.close(); },
  };
}

describe("MCP session resource lifetime", { timeout: 15_000 }, () => {
  it("persists vault ownership before opening, renews live leases and closes each lease once", async () => {
    const f = await fixture();
    const queries: { sql: string; params: unknown[] }[] = [];
    const execute = mock.method(f.host.db, "execute", async (statement: unknown) => { queries.push(new PgDialect().sqlToQuery(statement as any)); return { rows: [] }; });
    try {
      const session = await f.sessions.open("test", "synthetic");
      await f.sessions.closeIdle(Infinity);
      await Promise.all([f.sessions.close(session), f.sessions.close(session)]);
      assert.match(queries[0].sql, /insert into chat_browser_owner/);
      assert.deepEqual(queries[0].params, [`powerloom-chat-${session.id}`, "test"]);
      assert.equal(queries.filter(query => query.sql.includes("set expires_at")).length, 1);
      assert.equal(queries.filter(query => query.sql.includes("set closed_at")).length, 1);
    } finally { execute.mock.restore(); await f.close(); }
  });
  for (const [header, value, status] of [["accept", "application/json", 406], ["content-type", "text/plain", 415]] as const) {
    it(`rejects invalid ${header} before allocating`, async () => {
      const f = await fixture();
      try {
        const response = await f.initialize({ ...HEADERS, [header]: value });
        await response.text();
        assert.equal(response.status, status);
        assert.equal(f.allocations(), 0);
        assert.equal(f.sessions.count, 0);
      } finally { await f.close(); }
    });
  }

  for (const mode of ["reject", "throw"] as const) {
    it(`disposes an allocated but unregistered session when transport initialization ${mode}s`, async () => {
      const handle = mock.method(StreamableHTTPServerTransport.prototype, "handleRequest", async (_request: IncomingMessage, response: ServerResponse) => {
        if (mode === "throw") throw new Error("synthetic transport failure");
        response.writeHead(406).end();
      });
      const f = await fixture();
      try {
        const response = await f.initialize();
        await response.text();
        assert.equal(response.status, mode === "throw" ? 500 : 406);
        await f.sessions.closeIdle(-1);
        await f.sessions.closeAll();
        assert.equal(f.allocations(), 1);
        assert.equal(f.sessions.count, 0);
        assert.equal(f.cleanups(), 1);
      } finally { handle.mock.restore(); await f.close(); }
    });
  }

  it("disposes a session if its client disconnects while dependencies are still opening", async () => {
    const entered = deferred<void>();
    const proceed = deferred<typeof chat>();
    const f = await fixture(async () => { entered.resolve(); return proceed.promise; });
    const request = httpRequest(f.url, { method: "POST", headers: HEADERS });
    request.on("error", () => {});
    request.end(JSON.stringify(INITIALIZE));
    try {
      await entered.promise;
      request.destroy();
      await f.disconnected;
      proceed.resolve(chat);
      await f.cleaned;
      assert.equal(f.sessions.count, 0);
      assert.equal(f.cleanups(), 1);
    } finally { request.destroy(); proceed.resolve(chat); await f.close(); }
  });

  it("cleans up a failed open even though it was never registered", async () => {
    const f = await fixture(async () => undefined);
    try {
      await assert.rejects(f.sessions.open("test", "test"), /not configured/);
      await f.sessions.closeAll();
      assert.equal(f.cleanups(), 1);
    } finally { await f.close(); }
  });

  it("keeps disconnect cleanup attached while initialization is still streaming", async () => {
    const entered = deferred<void>();
    const handle = mock.method(StreamableHTTPServerTransport.prototype, "handleRequest", async (_request: IncomingMessage, response: ServerResponse) => {
      response.writeHead(200, { "content-type": "text/event-stream" });
      response.flushHeaders();
      entered.resolve();
      // Like the Node adapter, return before the response finishes streaming.
    });
    const f = await fixture();
    const request = httpRequest(f.url, { method: "POST", headers: HEADERS });
    request.on("error", () => {});
    request.end(JSON.stringify(INITIALIZE));
    try {
      await entered.promise;
      request.destroy();
      await f.cleaned;
      assert.equal(f.sessions.count, 0);
      assert.equal(f.cleanups(), 1);
    } finally { request.destroy(); handle.mock.restore(); await f.close(); }
  });

  it("waits for dependencies opening during shutdown and disposes them once", async () => {
    const f = await fixture();
    const entered = deferred<void>();
    const proceed = deferred<void>();
    const original = f.host.deps.forVault.bind(f.host.deps);
    const load = mock.method(f.host.deps, "forVault", async (vault: string) => {
      entered.resolve();
      await proceed.promise;
      return original(vault);
    });
    try {
      const opening = f.sessions.open("test", "test");
      const refused = assert.rejects(opening, /shutting down/);
      await entered.promise;
      const closing = f.sessions.closeAll();
      proceed.resolve();
      await Promise.all([closing, refused]);
      assert.equal(f.cleanups(), 1);
      await assert.rejects(f.sessions.open("test", "test"), /shutting down/);
    } finally { proceed.resolve(); load.mock.restore(); await f.close(); }
  });

  it("tracks pending sessions for idle and shutdown cleanup, each exactly once", async () => {
    const f = await fixture();
    try {
      const pending = await f.sessions.open("test", "test");
      assert.equal(f.sessions.count, 0);
      pending.lastUsedAt = 0;
      await f.sessions.closeIdle(1);
      await f.sessions.closeAll();
      assert.equal(f.cleanups(), 1);
    } finally { await f.close(); }
  });

  it("keeps successful sessions usable, then closes them once", async () => {
    const f = await fixture();
    try {
      const response = await f.initialize();
      await response.text();
      assert.equal(response.status, 200);
      const id = response.headers.get("mcp-session-id")!;
      assert.ok(f.sessions.get(id));
      assert.equal(f.cleanups(), 0);
      const listed = await fetch(f.url, { method: "POST", headers: { ...HEADERS, "mcp-session-id": id, "mcp-protocol-version": "2025-03-26" }, body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }) });
      assert.equal(listed.status, 200);
      assert.match(await listed.text(), /pbi_read/);
      await Promise.all([f.sessions.closeAll(), f.sessions.closeAll()]);
      assert.equal(f.sessions.count, 0);
      assert.equal(f.cleanups(), 1);
    } finally { await f.close(); }
  });
});
