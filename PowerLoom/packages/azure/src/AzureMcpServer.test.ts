import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { Protocol } from "@modelcontextprotocol/sdk/shared/protocol.js";
import { setImmediate } from "node:timers/promises";
import { AzureMcpServer } from "./AzureMcpServer";

// Starts the real server (no Azure call): the wrapper resolves, the binary runs on this platform, the tools come
// with their schemas and the read-only hint.
describe("AzureMcpServer", () => {
  for (const cleanupFails of [false, true]) {
    it(`awaits the real SDK's initialization cleanup exactly once${cleanupFails ? " even if cleanup throws" : ""}`, async () => {
      const failure = new Error("synthetic initialization failure");
      let beginClose!: () => void;
      let finishClose!: () => void;
      const began = new Promise<void>((resolve) => { beginClose = resolve; });
      const finished = new Promise<void>((resolve) => { finishClose = resolve; });
      const start = mock.method(StdioClientTransport.prototype, "start", async () => {});
      const request = mock.method(Client.prototype, "request", async () => { throw failure; });
      const close = mock.method(StdioClientTransport.prototype, "close", async () => {
        beginClose();
        await finished;
        if (cleanupFails) throw new Error("synthetic cleanup failure");
      });
      let settled = false;
      const starting = AzureMcpServer.start({ namespaces: ["group"], env: {} }).then(
        () => { settled = true; return null; },
        (error: unknown) => { settled = true; return error; },
      );
      try {
        await began;
        await setImmediate();
        assert.equal(settled, false, "startup must await the in-flight close");
        assert.equal(close.mock.callCount(), 1);
        finishClose();
        assert.equal(await starting, failure);
        assert.equal(close.mock.callCount(), 1);
      } finally {
        finishClose();
        await starting;
        close.mock.restore();
        request.mock.restore();
        start.mock.restore();
      }
    });
  }

  for (const [stage, cleanupFails] of [["beforeConnect", false], ["connect", false], ["listTools", false], ["listTools", true]] as const) {
    it(`closes the transport once when ${stage} fails and preserves the startup error${cleanupFails ? " even if cleanup throws" : ""}`, async () => {
      const failure = new Error(`${stage} failed`);
      const close = mock.method(StdioClientTransport.prototype, "close", async () => {
        if (cleanupFails) throw new Error("synthetic cleanup failure");
      });
      const start = mock.method(StdioClientTransport.prototype, "start", async () => {});
      const connect = mock.method(Client.prototype, "connect", async function (this: Client, transport: StdioClientTransport) {
        if (stage === "beforeConnect") throw failure;
        // Real protocol ownership, with no child process or network.
        await Protocol.prototype.connect.call(this, transport);
        if (stage === "connect") throw failure;
      });
      const list = mock.method(Client.prototype, "listTools", async () => { throw failure; });
      try {
        await assert.rejects(AzureMcpServer.start({ namespaces: ["group"], env: {} }), (error) => error === failure);
        assert.equal(close.mock.callCount(), 1);
      } finally {
        list.mock.restore();
        connect.mock.restore();
        start.mock.restore();
        close.mock.restore();
      }
    });
  }

  it("starts the server for a namespace and lists its tools", async () => {
    const close = mock.method(Client.prototype, "close");
    const server = await AzureMcpServer.start({ namespaces: ["group"], env: {} });

    try {
      const names = server.tools().map((tool) => tool.name);
      const list = server.tools().find((tool) => tool.name === "group_list");

      assert.ok(names.includes("group_list"), `got ${names.join(", ")}`);
      assert.equal(list?.readOnly, true);
      assert.equal(list?.inputSchema.properties.subscription?.type, "string");
      assert.equal(close.mock.callCount(), 0);
    } finally {
      try {
        await server.close();
        assert.equal(close.mock.callCount(), 1);
      } finally {
        close.mock.restore();
      }
    }
  });
});
