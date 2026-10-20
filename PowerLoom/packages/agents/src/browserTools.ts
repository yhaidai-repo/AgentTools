import type { ToolDefinition } from "@agenttools/runtime";
import type { BrowserAction, BrowserView, DevHubAnswer } from "@powerloom/devhub";
import { z } from "zod";
import type { AgentDeps } from "./models/AgentDeps";
import type { DevHubAccess } from "./models/DevHubAccess";
import type { OutsideAccessContext } from "./models/OutsideAccessContext";
import type { OutsideResource } from "./models/OutsideResource";
import type { OutsideToolResult } from "./models/OutsideToolResult";
import { defineOutsideTool } from "./outsideAccess";
import { addRunOutputs } from "./tasks/runOutputs";

const ACTIONS = ["navigate", "click", "fill", "press", "select", "check", "uncheck", "hover"] as const;

// The browser tools (user decision 2026-10-20: the browser runs on the host through DevHub, the existing bridge):
// one recorded case at a time, owned by the run like its stack; every call goes to the data access log under the
// DevHub kind. A closed case's recording is listed among the run's outputs.
export function createBrowserTools(deps: AgentDeps, context: OutsideAccessContext, access: DevHubAccess, owner: string, headless: boolean): ToolDefinition<any>[] {
  return [
    browserOpenTool(deps, context, access, owner, headless),
    browserSnapshotTool(deps, context, access),
    browserActTool(deps, context, access),
    browserCloseTool(deps, context, access, owner),
  ];
}

function browserOpenTool(deps: AgentDeps, context: OutsideAccessContext, access: DevHubAccess, owner: string, headless: boolean) {
  return defineOutsideTool(deps.outside, context, {
    name: "browser_open",
    description: `Open a recorded browser case on the host (Chromium, ${headless ? "headless" : "visible on the host's screen"}; video + trace saved under the case's name) and show the page. One case at a time: close it with browser_close before the next. Local services are at their URLs from list_services.`,
    input: {
      case: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/).describe("A short name for the recording, e.g. TC-1234 or login-happy-path"),
      url: z.string().url().optional().describe("The page to open first"),
    },
    resource: (input) => resourceOf(access, `browser:${input.case}`),
    request: (input) => `open ${input.case}${input.url ? ` at ${input.url}` : ""}`,
    handler: async (input) => viewResult(await access.client.openBrowser({ owner, case: input.case, url: input.url, headless })),
  });
}

function browserSnapshotTool(deps: AgentDeps, context: OutsideAccessContext, access: DevHubAccess) {
  return defineOutsideTool(deps.outside, context, {
    name: "browser_snapshot",
    description: "Show the open page again: address, title and its accessibility snapshot (roles and names to target with browser_act).",
    input: {},
    resource: () => resourceOf(access, "browser"),
    request: () => "snapshot",
    handler: async () => viewResult(await access.client.browserSnapshot()),
  });
}

function browserActTool(deps: AgentDeps, context: OutsideAccessContext, access: DevHubAccess) {
  return defineOutsideTool(deps.outside, context, {
    name: "browser_act",
    description: "Act on the open page and get its new snapshot. Target an element the way the snapshot names it: role + name (button \"Save\"), label, text, placeholder, or a CSS selector. A password is typed by DevHub from a dev-secrets value (valueName), never by you.",
    input: {
      action: z.enum(ACTIONS).describe("navigate (url), click, fill (value or valueName), press (key), select (value), check, uncheck, hover"),
      url: z.string().url().optional().describe("navigate: the address"),
      role: z.string().optional().describe("The ARIA role from the snapshot: button, link, textbox, checkbox, combobox, …"),
      name: z.string().optional().describe("The accessible name shown with the role"),
      label: z.string().optional().describe("A form field's label"),
      text: z.string().optional().describe("Visible text of the element"),
      placeholder: z.string().optional().describe("A field's placeholder"),
      selector: z.string().optional().describe("A CSS selector, when nothing else identifies the element"),
      exact: z.boolean().optional().describe("Match the name, label or text exactly (default: contains, case-insensitive)"),
      value: z.string().optional().describe("fill / select: the text to type or the option to pick"),
      valueName: z.string().optional().describe("fill: the name of a dev-secrets value to type instead of value, e.g. pvs-test-password"),
      key: z.string().optional().describe("press: the key, e.g. Enter, Tab, Escape"),
    },
    resource: () => resourceOf(access, "browser"),
    request: (input) => requestText(input),
    handler: async (input) => viewResult(await access.client.browserAct(input as BrowserAction)),
  });
}

function browserCloseTool(deps: AgentDeps, context: OutsideAccessContext, access: DevHubAccess, owner: string) {
  return defineOutsideTool(deps.outside, context, {
    name: "browser_close",
    description: "Close the open browser case: its video and trace are written on the host and listed with your run's outputs. Close every case you open.",
    input: {},
    resource: () => resourceOf(access, "browser"),
    request: () => "close",
    handler: async () => {
      const answer = await access.client.closeBrowser(owner);

      if (!answer.ok) {
        return failure(answer);
      }

      await addRunOutputs(deps.db, context.runId, answer.value.artifacts);

      return { text: `Closed ${answer.value.case}. Recording on the host:\n${answer.value.artifacts.join("\n")}`, rows: answer.value.artifacts.length };
    },
  });
}

// The log keeps what was done, never what was typed: a value may be an id, a name or a secret.
function requestText(input: { action: string; url?: string; role?: string; name?: string; label?: string; text?: string; placeholder?: string; selector?: string; key?: string }): string {
  const target = input.role ? `${input.role} "${input.name ?? ""}"` : input.label ?? input.text ?? input.placeholder ?? input.selector ?? input.url ?? "";

  return `${input.action} ${target}${input.key ? ` ${input.key}` : ""}`.trim();
}

function viewResult(answer: DevHubAnswer<BrowserView>): OutsideToolResult {
  if (!answer.ok) {
    return failure(answer);
  }

  const { url, title, snapshot, snapshotCut } = answer.value;
  const cut = snapshotCut ? "\n\n[the snapshot was cut: act on what is shown, or navigate to a smaller page]" : "";

  return { text: `${title} — ${url}\n\n${snapshot}${cut}`, truncated: snapshotCut };
}

function failure(answer: { message: string; denied: boolean }): OutsideToolResult {
  return { text: answer.message, isError: true, denied: answer.denied };
}

function resourceOf(access: DevHubAccess, resource: string): OutsideResource {
  return { kind: "localStack", resource, target: access.url };
}
