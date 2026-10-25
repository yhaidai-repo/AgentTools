import type { ToolDefinition } from "@agenttools/runtime";
import type { AzureMcpInputSchema } from "@powerloom/azure";
import type { McpEndpoint } from "@powerloom/devhub";
import { z } from "zod";
import { jsonSchemaShape } from "../azure/jsonSchemaShape";
import type { AgentDeps } from "../models/AgentDeps";
import type { DevHubAccess } from "../models/DevHubAccess";
import type { OutsideAccessContext } from "../models/OutsideAccessContext";
import type { OutsideResource } from "../models/OutsideResource";
import type { OutsideToolResult } from "../models/OutsideToolResult";
import { defineOutsideTool } from "../outsideAccess";
import { addRunOutputs } from "../tasks/runOutputs";
import type { BrowserCase } from "./models/BrowserCase";
import type { PlaywrightMcpTool } from "./models/PlaywrightMcpTool";
import { PlaywrightMcpClient } from "./PlaywrightMcpClient";
import { PLAYWRIGHT_MCP_TOOLS } from "./playwrightMcpTools";

// The MCP tools the agent doesn't get: the case's lifecycle and recordings are browser_open / browser_close here,
// code execution is not a test step, and the action recorder makes Playwright code nobody runs.
const HIDDEN_TOOLS = new Set(["browser_close", "browser_start_video", "browser_stop_video", "browser_start_tracing", "browser_stop_tracing", "browser_video_chapter", "browser_video_show_actions", "browser_video_hide_actions", "browser_run_code_unsafe", "browser_start_recording", "browser_stop_recording", "browser_install"]);
const VIDEO_SIZE = { width: 1280, height: 720 };

// How the run reaches the open case's MCP; tests give a fake.
export type McpConnect = (endpoint: McpEndpoint) => Promise<Pick<PlaywrightMcpClient, "call" | "close">>;
const MAX_ANSWER_CHARS = 60_000;

// The browser tools (user decisions 2026-10-20): the official Playwright MCP, started by DevHub on the host per case
// and driven through DevHub's proxy, headless or in a window; video + trace per case; a password typed by DevHub from
// a dev-secrets value. Every call goes to the data access log under the DevHub kind.
export function createBrowserTools(deps: AgentDeps, context: OutsideAccessContext, access: DevHubAccess, owner: string, headless: boolean, connect: McpConnect = PlaywrightMcpClient.connect): ToolDefinition<any>[] {
  const open: BrowserCase = { name: null, client: null };

  return [
    browserOpenTool(deps, context, access, owner, headless, open, connect),
    browserCloseTool(deps, context, access, owner, open),
    typeSecretTool(deps, context, access, open),
    ...PLAYWRIGHT_MCP_TOOLS.filter((tool) => !HIDDEN_TOOLS.has(tool.name)).map((tool) => proxiedTool(deps, context, access, open, tool)),
  ];
}

function browserOpenTool(deps: AgentDeps, context: OutsideAccessContext, access: DevHubAccess, owner: string, headless: boolean, open: BrowserCase, connect: McpConnect) {
  return defineOutsideTool(deps.outside, context, {
    name: "browser_open",
    description: `Open a recorded browser case on the host (${headless ? "headless" : "a window on the host's screen"}; video + trace saved under the case's name) before any other browser_* tool. One case at a time: browser_close it before the next. Local services are at their URLs from list_services.`,
    input: { case: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/).describe("A short name for the recording, e.g. TC-1234 or login-happy-path") },
    resource: (input) => resourceOf(access, `browser:${input.case}`),
    request: (input) => `open ${input.case}`,
    handler: async (input) => {
      const opened = await access.client.openBrowser({ owner, case: input.case, headless });

      if (!opened.ok) {
        return failure(opened);
      }

      open.name = input.case;
      open.client = await connect(access.client.mcpEndpoint());

      const recording = await startRecordings(open.client);

      return { text: `Case ${input.case} is open (${headless ? "headless" : "visible on the host"}); recording started.${recording}` };
    },
  });
}

function browserCloseTool(deps: AgentDeps, context: OutsideAccessContext, access: DevHubAccess, owner: string, open: BrowserCase) {
  return defineOutsideTool(deps.outside, context, {
    name: "browser_close",
    description: "Close the open browser case: the video and trace are written on the host and listed with your run's outputs. Close every case you open, before the next one and before your report.",
    input: {},
    resource: () => resourceOf(access, `browser:${open.name ?? "none"}`),
    request: () => `close ${open.name ?? "none"}`,
    handler: async () => {
      await open.client?.close();
      open.client = null;

      const closed = await access.client.closeBrowser(owner);

      if (!closed.ok) {
        return failure(closed);
      }

      open.name = null;

      if (context.runId !== null) {
        await addRunOutputs(deps.db, context.runId, closed.value.artifacts);
      }


      return { text: `Closed ${closed.value.case}. Recording on the host:\n${closed.value.artifacts.join("\n")}`, rows: closed.value.artifacts.length };
    },
  });
}

function typeSecretTool(deps: AgentDeps, context: OutsideAccessContext, access: DevHubAccess, open: BrowserCase) {
  return defineOutsideTool(deps.outside, context, {
    name: "browser_type_secret",
    description: "Type a dev-secrets value (a password, a key) into a field without seeing it: DevHub types it on the host. Use it instead of browser_type for any secret. The field is the snapshot's ref, e.g. e12.",
    input: {
      element: z.string().min(1).describe("Human-readable description of the field, e.g. 'Password box of the sign-in form'"),
      target: z.string().min(1).describe("The field's ref from the snapshot, e.g. e12"),
      valueName: z.string().min(1).describe("The dev-secrets value to type, e.g. app-dev-password"),
      submit: z.boolean().optional().describe("Press Enter after typing"),
    },
    resource: () => resourceOf(access, `browser:${open.name ?? "none"}`),
    request: (input) => `type secret ${input.valueName} into ${input.target}`,
    handler: async (input) => {
      if (!open.name) {
        return noCase();
      }

      const answer = await access.client.typeSecret(input);

      if (!answer.ok) {
        return failure(answer);
      }

      return { text: answer.value.text, isError: answer.value.isError };
    },
  });
}

function proxiedTool(deps: AgentDeps, context: OutsideAccessContext, access: DevHubAccess, open: BrowserCase, tool: PlaywrightMcpTool) {
  return defineOutsideTool(deps.outside, context, {
    name: tool.name,
    description: tool.name === "browser_type" ? `${tool.description} Never type a password or key here: use browser_type_secret.` : tool.description,
    input: jsonSchemaShape(tool.inputSchema as unknown as AzureMcpInputSchema),
    // The catalog says which browser tools only look (snapshot, screenshot) and which act (click, type, fill).
    annotations: { readOnly: tool.readOnly },
    resource: () => resourceOf(access, `browser:${open.name ?? "none"}`),
    request: (input) => requestOf(tool, input),
    handler: async (input) => {
      if (!open.client) {
        return noCase();
      }

      const result = await open.client.call(tool.name, input);
      const cut = result.text.length > MAX_ANSWER_CHARS ? `\n\n[cut at ${MAX_ANSWER_CHARS} of ${result.text.length} characters]` : "";

      return { text: `${result.text.slice(0, MAX_ANSWER_CHARS)}${cut}`, images: result.images, isError: result.isError, truncated: cut.length > 0 };
    },
  });
}

async function startRecordings(client: Pick<PlaywrightMcpClient, "call">): Promise<string> {
  const video = await client.call("browser_start_video", { size: VIDEO_SIZE });
  const trace = await client.call("browser_start_tracing", {});
  const problems = [video, trace].filter((result) => result.isError).map((result) => result.text);

  return problems.length === 0 ? "" : ` Recording problems: ${problems.join("; ")}`;
}

// The log keeps what was done, never what was typed: a value may be an id, a name or a secret.
function requestOf(tool: PlaywrightMcpTool, input: Record<string, unknown>): string {
  const shown = Object.entries(input).filter(([key]) => ["url", "target", "element", "key", "action", "time", "text"].includes(key) && !(tool.name === "browser_type" && key === "text")).map(([key, value]) => `${key}=${String(value).slice(0, 80)}`);

  return `${tool.name} ${shown.join(" ")}`.trim();
}

function noCase(): OutsideToolResult {
  return { text: "No browser case is open: call browser_open first.", isError: true };
}

function failure(answer: { message: string; denied: boolean }): OutsideToolResult {
  return { text: answer.message, isError: true, denied: answer.denied };
}

function resourceOf(access: DevHubAccess, resource: string): OutsideResource {
  return { kind: "localStack", resource, target: access.url };
}
