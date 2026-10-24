import type { ToolDefinition } from "@agenttools/runtime";
import { z } from "zod";
import type { AgentDeps } from "../models/AgentDeps";
import type { DevHubAccess } from "../models/DevHubAccess";
import type { OutsideAccessContext } from "../models/OutsideAccessContext";
import type { OutsideResource } from "../models/OutsideResource";
import type { OutsideToolResult } from "../models/OutsideToolResult";
import { defineOutsideTool } from "../outsideAccess";

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

// Secrets stay on the host (user decision 2026-10-20): the agent learns value names, and DevHub fills them into a
// request it sends from the host (an API call with a key) or types them into a page (browser_type_secret).
export function createSecretTools(deps: AgentDeps, context: OutsideAccessContext, access: DevHubAccess): ToolDefinition<any>[] {
  return [listSecretNamesTool(deps, context, access), httpRequestTool(deps, context, access)];
}

function listSecretNamesTool(deps: AgentDeps, context: OutsideAccessContext, access: DevHubAccess) {
  return defineOutsideTool(deps.outside, context, {
    name: "list_secret_names",
    description: "List the names of the dev-secrets values DevHub can use for you (never their values): users, passwords, API keys, URLs. Use a name in browser_type_secret or as {{secret:<name>}} in http_request.",
    input: {},
    resource: () => resourceOf(access, "secret-names"),
    request: () => "list secret names",
    handler: async () => {
      const answer = await access.client.secretNames();

      if (!answer.ok) {
        return failure(answer);
      }

      return { text: answer.value.names.join("\n"), rows: answer.value.names.length };
    },
  });
}

function httpRequestTool(deps: AgentDeps, context: OutsideAccessContext, access: DevHubAccess) {
  return defineOutsideTool(deps.outside, context, {
    name: "http_request",
    description: "Send an HTTP request from the host (local services and Azure dev are reachable there) with secrets filled in: write {{secret:<name>}} where a value goes, or {{secret:<name>|basic}} for a Basic authorization header whose password is the secret (the PVS API takes its key that way). The answer's body is redacted and cut at 60k characters.",
    input: {
      method: z.enum(METHODS),
      url: z.string().url(),
      headers: z.record(z.string(), z.string()).optional().describe('e.g. { "Authorization": "{{secret:pvs-web-api-key|basic}}", "Accept": "application/json" }'),
      body: z.string().optional().describe("The request body; placeholders allowed"),
      contentType: z.string().optional().describe("Default application/json"),
    },
    resource: (input) => resourceOf(access, new URL(input.url).host),
    request: (input) => `${input.method} ${input.url}`,
    handler: async (input) => {
      const answer = await access.client.httpRequest(input);

      if (!answer.ok) {
        return failure(answer);
      }

      const { status, headers, body, bodyCut } = answer.value;
      const headerLines = Object.entries(headers).map(([name, value]) => `${name}: ${value}`);

      return { text: [`HTTP ${status}`, ...headerLines, "", body, ...(bodyCut ? ["[body cut at 60000 characters]"] : [])].join("\n"), isError: status >= 500, truncated: bodyCut };
    },
  });
}

function failure(answer: { message: string; denied: boolean }): OutsideToolResult {
  return { text: answer.message, isError: true, denied: answer.denied };
}

function resourceOf(access: DevHubAccess, resource: string): OutsideResource {
  return { kind: "localStack", resource, target: access.url };
}
