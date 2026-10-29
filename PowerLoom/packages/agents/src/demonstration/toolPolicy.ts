import type { ToolDefinition } from "@agenttools/runtime";
import type { DevHubClient } from "@powerloom/devhub";
import { guideUrlAllowed, readGuideRequest } from "@powerloom/core";
import { GuideCapture } from "./capture/GuideCapture";

// Task-scoped UI boundary. DevHub remains a browser host in remote mode, without local stack control. The capture
// boundary (masked screenshots, GIF frames) sits inside it: the policy checks the page before a capture runs.
export function demonstrationTools(tools: ToolDefinition<any>[], body: string, capture = new GuideCapture(), owner = "", client: DevHubClient | null = null): ToolDefinition<any>[] {
  let request;
  try { request = readGuideRequest(body); } catch { return []; }
  capture.bind(owner, client, request.maskSelectors);
  const origins = request.allowedOrigins;
  const snapshot = tools.find(tool => tool.name === "browser_snapshot");
  const scoped = tools.filter(tool => tool.name !== "http_request").filter(tool => request.mode !== "remote-url" || !["list_services", "start_stack", "stack_status", "stack_logs", "stop_stack"].includes(tool.name));
  return capture.wrap(scoped).map(tool => ({
    ...tool,
    handler: async (input: any) => {
      if (tool.name === "start_stack" && (input.branch !== request.branch || input.services.some((s: string) => !request.services.includes(s)))) return denied("Start only the requested branch and services.");
      if ((tool.name === "browser_navigate" || tool.name === "http_request" || tool.name === "browser_tabs") && input.url && !guideUrlAllowed(input.url, origins)) return denied("URL is outside the guide's allowed origins.");
      if (tool.name.startsWith("browser_") && !["browser_open", "browser_close", "browser_navigate", "browser_snapshot", "browser_tabs"].includes(tool.name)) {
        if (!snapshot) return denied("Browser snapshot unavailable.");
        const current = await snapshot.handler({});
        if (!pageAllowed(current.text, origins)) return denied("Current page is outside the guide's allowed origins or could not be verified. Navigate to an allowed URL.");
      }
      const result = await tool.handler(tool.name === "start_stack" ? { ...input, strictBranch: true } : input);
      if (["browser_navigate", "browser_snapshot"].includes(tool.name) && !result.isError && !pageAllowed(result.text, origins)) {
        if (/Page URL:\s*about:blank(?:\s|$)/.test(result.text)) return denied(`The browser case is still blank. Use browser_navigate with the task's allowed URL ${request.url} before taking a snapshot. No new sign-in origin is needed for a blank page.`);
        return denied("Navigation reached an unapproved or unverifiable page. Add the required sign-in origin to task inputs before continuing.");
      }
      return result;
    },
  }));
}
function pageAllowed(text: string, origins: string[]): boolean {
  const url = /Page URL:\s*(\S+)/.exec(text)?.[1];
  return url !== undefined && guideUrlAllowed(url, origins);
}
function denied(text: string) { return { text, isError: true }; }
