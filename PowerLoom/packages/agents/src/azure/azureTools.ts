import type { AgentDefinition } from "@agenttools/config";
import type { ToolDefinition } from "@agenttools/runtime";
import type { AzureMcpAnswer, AzureMcpServer, AzureMcpTool } from "@powerloom/azure";
import type { AzureResourceSettings } from "@powerloom/core";
import { z } from "zod";
import type { AgentDeps } from "../models/AgentDeps";
import type { AzureAccess } from "../models/AzureAccess";
import type { OutsideAccessContext } from "../models/OutsideAccessContext";
import type { OutsideToolResult } from "../models/OutsideToolResult";
import { defineOutsideTool } from "../outsideAccess";
import { AZURE_ACCESS_INTEGRATION, READ_COSMOS_INTEGRATION } from "./azureIntegrations";
import { jsonSchemaShape } from "./jsonSchemaShape";
import { createMongoTools } from "./mongoTools";
import { createServiceBusTools } from "./serviceBusTools";

// The server's namespaces behind the Azure access switch; `cosmos` is its own kind with an allow-list of accounts.
export const AZURE_ACCESS_NAMESPACES = ["monitor", "applicationinsights", "servicebus", "group", "subscription"];
export const COSMOS_NAMESPACE = "cosmos";

// Never offered, whatever the server lists: tools whose answers would carry keys, connection strings or settings.
const SECRET_TOOL = /key|secret|connection|appsettings|credential/i;

// The server fills these from its environment (the sign-in's tenant) or the proxy does (Cosmos keys): an agent
// names neither.
const INJECTED = ["tenant", "auth-method"];

// What a call reads, for the data access log: the first of these the agent named, else the tool's namespace.
const MAIN_TARGET = ["account", "namespace", "resource-id", "workspace", "resource", "resource-name", "resource-group", "subscription"];

type ToolInput = Record<string, unknown>;

// The Read Azure tools (user decision 2026-10-14): the Azure MCP server's read-only tools, each re-exposed through
// the outside wrapper (logged, a refusal raises an access request), plus the Service Bus peek and the Mongo tools. Azure access tools exist
// when the agent's and the vault's switches are on; Cosmos tools when both Cosmos switches are on and an account is enabled.
export function createAzureTools(deps: AgentDeps, agent: AgentDefinition, context: OutsideAccessContext): ToolDefinition<any>[] {
  const azure = deps.azure;

  if (!azure) {
    return [];
  }

  return [...serverTools(deps, agent, context, azure, azure.server), ...createServiceBusTools(deps, agent, context), ...createMongoTools(deps, agent, context)];
}

function serverTools(deps: AgentDeps, agent: AgentDefinition, context: OutsideAccessContext, azure: AzureAccess, server: AzureMcpServer | null): ToolDefinition<any>[] {
  if (!server) {
    return [];
  }

  const accounts = cosmosAccounts(azure);
  const accessOn = switchedOn(agent, azure, AZURE_ACCESS_INTEGRATION, "azureAccess");
  const cosmosOn = switchedOn(agent, azure, READ_COSMOS_INTEGRATION, "cosmos") && accounts.length > 0;

  return server
    .tools()
    .filter((tool) => offered(tool, accessOn, cosmosOn))
    .map((tool) => (namespaceOf(tool.name) === COSMOS_NAMESPACE ? cosmosTool(deps, context, server, tool, accounts) : accessTool(deps, context, server, tool)));
}

function offered(tool: AzureMcpTool, accessOn: boolean, cosmosOn: boolean): boolean {
  if (!tool.readOnly || SECRET_TOOL.test(tool.name)) {
    return false;
  }

  const namespace = namespaceOf(tool.name);

  return namespace === COSMOS_NAMESPACE ? cosmosOn : accessOn && AZURE_ACCESS_NAMESPACES.includes(namespace);
}

function accessTool(deps: AgentDeps, context: OutsideAccessContext, server: AzureMcpServer, tool: AzureMcpTool): ToolDefinition<any> {
  return defineOutsideTool(deps.outside, context, {
    name: tool.name,
    description: tool.description,
    input: jsonSchemaShape(tool.inputSchema, INJECTED),
    resource: (input: ToolInput) => ({ kind: "azure", resource: mainTarget(tool, input), target: mainTarget(tool, input) }),
    request: (input: ToolInput) => requestOf(tool, input),
    handler: async (input: ToolInput) => resultOf(await server.call(tool.name, input)),
  });
}

// A Cosmos tool takes one of the vault's enabled accounts and reads it with the account's read-only key, which the
// server fetches with the sign-in (the user has no Cosmos data-plane role, runtime-verified 2026-10-14).
function cosmosTool(deps: AgentDeps, context: OutsideAccessContext, server: AzureMcpServer, tool: AzureMcpTool, accounts: AzureResourceSettings[]): ToolDefinition<any> {
  const names = accounts.map((account) => account.target) as [string, ...string[]];
  const input = { ...jsonSchemaShape(tool.inputSchema, INJECTED), account: z.enum(names).describe(`The Cosmos DB account: ${names.join(", ")}`) };

  return defineOutsideTool(deps.outside, context, {
    name: tool.name,
    description: tool.description,
    input,
    resource: (call: ToolInput) => ({ kind: "cosmos", resource: String(call.account), target: String(call.account) }),
    request: (call: ToolInput) => requestOf(tool, call),
    handler: async (call: ToolInput) => {
      if (!names.includes(String(call.account))) {
        return { text: `${String(call.account)} isn't an enabled Cosmos DB account of this vault: ${names.join(", ")}.`, isError: true, refusal: "account not enabled" };
      }

      return resultOf(await server.call(tool.name, { ...call, "auth-method": "key" }));
    },
  });
}

function resultOf(answer: AzureMcpAnswer): OutsideToolResult {
  if (!answer.ok) {
    return { text: answer.message, isError: true, denied: answer.denied };
  }

  return { text: answer.text, rows: answer.rows ?? undefined, truncated: answer.text.includes("[cut at ") };
}

function switchedOn(agent: AgentDefinition, azure: AzureAccess, integration: string, kind: "azureAccess" | "cosmos"): boolean {
  return agent.capabilities.integrations?.[integration] === true && azure.settings.enabledKinds[kind] === true;
}

function cosmosAccounts(azure: AzureAccess): AzureResourceSettings[] {
  return azure.settings.resources.filter((resource) => resource.kind === "cosmos" && resource.enabled);
}

function namespaceOf(name: string): string {
  return name.split("_")[0];
}

function mainTarget(tool: AzureMcpTool, input: ToolInput): string {
  const named = MAIN_TARGET.find((key) => typeof input[key] === "string" && (input[key] as string).length > 0);

  return named ? String(input[named]) : namespaceOf(tool.name);
}

function requestOf(tool: AzureMcpTool, input: ToolInput): string {
  return `${tool.name} ${JSON.stringify(input)}`;
}
