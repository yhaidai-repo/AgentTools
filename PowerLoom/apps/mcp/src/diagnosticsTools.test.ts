import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import { it } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createPowerLoomClient, createPowerLoomPort } from "@powerloom/client";
import { commandTools } from "@powerloom/agents";
import type { CommandContext } from "@powerloom/core";
import { registerTools } from "./registerTools";

const TRACE = "1234567890abcdef1234567890abcdef";
const TOOL_NAMES = ["performance_read", "telemetry_logs", "traces_list", "trace_get"];

async function fixture() {
  let state = "ready";
  const requests: { method: string; url: URL }[] = [];
  const http = createServer((request, response) => {
    const url = new URL(request.url!, "http://test");
    requests.push({ method: request.method!, url });
    response.setHeader("content-type", "application/json");
    if (url.pathname === "/api/status/performance") {
      response.end(JSON.stringify({ from: "2030-01-01T00:00:00Z", to: "2030-01-02T00:00:00Z", intervalSeconds: 300,
        points: ["2030-01-01T12:00:00Z", "2030-01-01T23:55:00Z"].map(at => ({ at, requestsPerMinute: null, averageLatencyMs: null, workingSetBytes: null, observedMinutes: 0 })) }));
    } else {
      response.end(JSON.stringify({ state, message: state === "disabled" ? "Diagnostics disabled." : state === "unavailable" ? "Diagnostics could not be read." : null, items: state === "ready" ? [{ traceId: TRACE }] : [], truncated: false, scanned: state === "ready" ? 1 : 0 }));
    }
  });
  http.listen(0, "127.0.0.1");
  await once(http, "listening");
  const address = http.address();
  assert.ok(address && typeof address !== "string");
  const context = { powerloom: createPowerLoomPort(createPowerLoomClient(`http://127.0.0.1:${address.port}`)) } as CommandContext;
  const server = new McpServer({ name: "inspection-test", version: "1" });
  registerTools(server, commandTools(context));
  const client = new Client({ name: "inspection-client", version: "1" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  return { client, requests, setState(value: string) { state = value; }, async close() { await client.close(); await server.close(); await new Promise<void>((resolve, reject) => http.close(error => error ? reject(error) : resolve())); } };
}

function text(result: Awaited<ReturnType<Client["callTool"]>>): string {
  return (result.content as { type: string; text?: string }[]).filter(item => item.type === "text").map(item => item.text).join("\n");
}

it("advertises four read-only tools and carries validated filters through MCP to the backend", async () => {
  const test = await fixture();
  try {
    const listed = (await test.client.listTools()).tools;
    for (const name of TOOL_NAMES) assert.equal(listed.find(tool => tool.name === name)?.annotations?.readOnlyHint, true, name);
    const logs = await test.client.callTool({ name: "telemetry_logs", arguments: { service: "PowerLoom", severity: "Error", hours: 2, search: "failed", limit: 10 } });
    assert.notEqual(logs.isError, true);
    assert.match(text(logs), new RegExp(TRACE));
    const logsRequest = test.requests.at(-1)!.url;
    assert.equal(logsRequest.pathname, "/api/status/telemetry/logs");
    assert.equal(logsRequest.searchParams.get("resource"), "PowerLoom");
    assert.equal(logsRequest.searchParams.get("severity"), "Error");
    assert.equal(logsRequest.searchParams.get("hours"), "2");
    assert.equal(logsRequest.searchParams.get("limit"), "10");
    await test.client.callTool({ name: "traces_list", arguments: { errorsOnly: true, minDurationMs: 100 } });
    assert.equal(test.requests.at(-1)!.url.searchParams.get("errorsOnly"), "true");
    assert.equal(test.requests.at(-1)!.url.searchParams.get("minDurationMs"), "100");
    await test.client.callTool({ name: "trace_get", arguments: { traceId: TRACE } });
    assert.equal(test.requests.at(-1)!.url.pathname, `/api/status/telemetry/traces/${TRACE}`);
    assert.ok(test.requests.every(request => request.method === "GET"));
  } finally { await test.close(); }
});

it("reports disabled/unavailable as MCP errors while performance history stays available with gaps", async () => {
  const test = await fixture();
  try {
    for (const state of ["disabled", "unavailable"]) {
      test.setState(state);
      for (const name of TOOL_NAMES.slice(1)) {
        const result = await test.client.callTool({ name, arguments: name === "trace_get" ? { traceId: TRACE } : {} });
        assert.equal(result.isError, true);
        assert.match(text(result), state === "disabled" ? /Diagnostics disabled/ : /could not be read/);
      }
    }
    const performance = await test.client.callTool({ name: "performance_read", arguments: { hours: 1 } });
    assert.notEqual(performance.isError, true);
    const history = JSON.parse(text(performance));
    assert.equal(history.from, "2030-01-01T23:00:00.000Z");
    assert.equal(history.points.length, 1);
    assert.equal(history.points[0].requestsPerMinute, null);
  } finally { await test.close(); }
});

it("rejects invalid IDs, excessive limits and invalid hours before sending an API request", async () => {
  const test = await fixture();
  try {
    for (const [name, args] of [["trace_get", { traceId: "../secrets" }], ["trace_get", { traceId: "0".repeat(32) }], ["telemetry_logs", { limit: 10000 }], ["performance_read", { hours: 25 }]]) {
      const result = await test.client.callTool({ name: String(name), arguments: args as Record<string, unknown> });
      assert.equal(result.isError, true);
    }
    assert.equal(test.requests.length, 0);
  } finally { await test.close(); }
});
