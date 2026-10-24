import assert from "node:assert/strict";
import { test } from "node:test";
import { z } from "zod";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { CodexToolServer } from "./CodexToolServer";

test("requires its bearer token, lists only request tools and handles parallel calls", async () => {
  const server = await CodexToolServer.start([{
    name: "read_note", description: "Read", input: { path: z.string() },
    annotations: { readOnly: true }, handler: async ({ path }) => ({ text: "read_note " + path }),
  }], new AbortController().signal);
  const client = new Client({ name: "test", version: "1" });

  try {
    assert.equal((await fetch(server.url, { method: "POST" })).status, 401);
    await client.connect(new StreamableHTTPClientTransport(new URL(server.url), { requestInit: { headers: { Authorization: "Bearer " + server.token } } }));

    const tools = await client.listTools();
    const results = await Promise.all(["a", "b"].map((path) => client.callTool({ name: "read_note", arguments: { path } })));

    assert.deepEqual(tools.tools.map((tool) => tool.name), ["read_note"]);
    assert.equal(tools.tools[0].annotations?.readOnlyHint, true);
    assert.deepEqual(results[0].content, [{ type: "text", text: "mcp__agent__read_note a" }]);
    assert.deepEqual(results[1].content, [{ type: "text", text: "mcp__agent__read_note b" }]);
    assert.equal((await client.callTool({ name: "read_note", arguments: {} })).isError, true);
  } finally {
    await client.close();
    await server.close();
  }
});

test("returns handler failures as MCP tool errors", async () => {
  const server = await CodexToolServer.start([{ name: "fail", description: "", input: {}, handler: async () => { throw new Error("expected failure"); } }], new AbortController().signal);
  const client = new Client({ name: "test", version: "1" });

  try {
    await client.connect(new StreamableHTTPClientTransport(new URL(server.url), { requestInit: { headers: { Authorization: "Bearer " + server.token } } }));

    const result = await client.callTool({ name: "fail", arguments: {} });

    assert.equal(result.isError, true);
    assert.deepEqual(result.content, [{ type: "text", text: "Error: expected failure" }]);
  } finally {
    await client.close();
    await server.close();
  }
});
