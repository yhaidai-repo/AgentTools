import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { DevHubClient, McpEndpoint } from "@powerloom/devhub";
import type { DataAccessLog } from "../DataAccessLog";
import type { AgentDeps } from "../models/AgentDeps";
import type { DataAccessEntry } from "../models/DataAccessEntry";
import { createBrowserTools } from "./browserTools";
import type { McpCallResult } from "./models/McpCallResult";

const context = { vault: "work-projects", agentId: "autotest", runId: 7, owner: "powerloom-run-7", taskId: "TT-1-001", pbiId: 1 };
const status = { open: true, owner: "powerloom-run-7", case: "TC-1234", headless: true, startedAt: null, expiresAt: null, mcpSessionKnown: false };

function harness(answers: Record<string, McpCallResult> = {}) {
  const entries: DataAccessEntry[] = [];
  const outputs: string[][] = [];
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  const devHub: Record<string, unknown> = {};
  const log = { record: async (entry: DataAccessEntry) => { entries.push(entry); } } as unknown as DataAccessLog;
  const db = { select: () => ({ from: () => ({ where: async () => [{ outputs: [] }] }) }), update: () => ({ set: (row: { outputs: string[] }) => ({ where: async () => { outputs.push(row.outputs); } }) }) };
  const deps = { outside: { log, requests: { request: async () => ({ id: "HT-1-001", created: true }) } }, db } as unknown as AgentDeps;
  const client = {
    openBrowser: async (request: unknown) => { devHub.opened = request; return { ok: true as const, value: status }; },
    closeBrowser: async (owner: string) => { devHub.closed = owner; return { ok: true as const, value: { case: "TC-1234", artifacts: ["D:/x/TC-1234/video.webm", "D:/x/TC-1234/trace.zip"] } }; },
    typeSecret: async (request: unknown) => { devHub.typed = request; return { ok: true as const, value: { text: "Typed.", isError: false } }; },
    mcpEndpoint: (): McpEndpoint => ({ url: "http://devhub/browser/mcp", headers: { Authorization: "Bearer t" } }),
  } as unknown as DevHubClient;
  const mcp = { call: async (name: string, args: Record<string, unknown>) => { calls.push({ name, args }); return answers[name] ?? { text: `${name} done`, images: [], isError: false }; }, close: async () => {} };
  const tools = createBrowserTools(deps, context, { client, url: "http://devhub" }, "powerloom-run-7", true, async () => mcp);

  return { tool: (name: string) => tools.find((tool) => tool.name === name)!, tools, entries, outputs, calls, devHub };
}

describe("createBrowserTools", () => {
  it("offers the case tools and the MCP's tools, without the hidden ones", () => {
    const names = harness().tools.map((tool) => tool.name);

    assert.deepEqual(names.slice(0, 3), ["browser_open", "browser_close", "browser_type_secret"]);
    assert.ok(names.includes("browser_navigate") && names.includes("browser_click") && names.includes("browser_take_screenshot"));
    assert.ok(!names.includes("browser_start_video") && !names.includes("browser_run_code_unsafe"));
  });

  it("refuses an MCP tool while no case is open", async () => {
    const result = await harness().tool("browser_navigate").handler({ url: "https://localhost:5001" });

    assert.equal(result.isError, true);
    assert.match(result.text, /browser_open first/);
  });

  it("opens a case on DevHub as the run's owner, connects and starts the recordings", async () => {
    const { tool, calls, devHub, entries } = harness();

    const result = await tool("browser_open").handler({ case: "TC-1234" });

    assert.deepEqual(devHub.opened, { owner: "powerloom-run-7", case: "TC-1234", headless: true });
    assert.deepEqual(calls.map((call) => call.name), ["browser_start_video", "browser_start_tracing"]);
    assert.match(result.text, /^Case TC-1234 is open/);
    assert.equal(entries[0].resource, "browser:TC-1234");
  });

  it("passes an MCP tool's text and images on, and logs what was done but not what was typed", async () => {
    const { tool, entries } = harness({ browser_take_screenshot: { text: "### Result", images: [{ data: "iVBOR", mimeType: "image/png" }], isError: false } });
    await tool("browser_open").handler({ case: "TC-1234" });

    const shot = await tool("browser_take_screenshot").handler({ type: "png" });
    await tool("browser_type").handler({ element: "User name", target: "e5", text: "john" });

    assert.deepEqual(shot.images, [{ data: "iVBOR", mimeType: "image/png" }]);
    assert.equal(entries.at(-1)?.request, "browser_type element=User name target=e5");
  });

  it("types a secret through DevHub, never through the MCP", async () => {
    const { tool, calls, devHub } = harness();
    await tool("browser_open").handler({ case: "TC-1234" });

    const result = await tool("browser_type_secret").handler({ element: "Password", target: "e6", valueName: "pvs-dev-password-yhaidai" });

    assert.deepEqual(devHub.typed, { element: "Password", target: "e6", valueName: "pvs-dev-password-yhaidai" });
    assert.ok(!calls.some((call) => call.name === "browser_type"));
    assert.equal(result.text, "Typed.");
  });

  it("closes the case on DevHub and lists the recording among the run's outputs", async () => {
    const { tool, outputs, devHub } = harness();
    await tool("browser_open").handler({ case: "TC-1234" });

    const result = await tool("browser_close").handler({});

    assert.equal(devHub.closed, "powerloom-run-7");
    assert.deepEqual(outputs, [["D:/x/TC-1234/video.webm", "D:/x/TC-1234/trace.zip"]]);
    assert.match(result.text, /^Closed TC-1234\./);
  });
});
