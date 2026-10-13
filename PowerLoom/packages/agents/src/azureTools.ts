import type { AgentDefinition } from "@agenttools/config";
import type { ToolDefinition } from "@agenttools/runtime";
import type { AzureAnswer } from "@powerloom/azure";
import type { AzureResourceKind, AzureResourceSettings } from "@powerloom/core";
import { toMarkdownTable } from "@powerloom/sql";
import { z } from "zod";
import { READ_AZURE_LOGS_INTEGRATION, READ_COSMOS_INTEGRATION } from "./azureIntegrations";
import type { AgentDeps } from "./models/AgentDeps";
import type { AzureAccess } from "./models/AzureAccess";
import type { OutsideAccessContext } from "./models/OutsideAccessContext";
import type { OutsideResource } from "./models/OutsideResource";
import type { OutsideToolResult } from "./models/OutsideToolResult";
import { defineOutsideTool } from "./outsideAccess";

// An answer's text is cut here so one wide result can't fill the agent's context (as for Read SQL).
const MAX_ANSWER_CHARS = 60_000;

// The Read Azure tools (user decisions 2026-10-12/13), kind by kind: a kind's tools exist for a run only when the
// agent's switch for it, the vault's switch for it and at least one enabled resource of it line up. Every call goes
// through the outside wrapper: logged, and a refusal raises an access request.
export function createAzureTools(deps: AgentDeps, agent: AgentDefinition, context: OutsideAccessContext): ToolDefinition<any>[] {
  if (!deps.azure) {
    return [];
  }

  return [...logsTools(deps, agent, context, deps.azure), ...cosmosTools(deps, agent, context, deps.azure)];
}

function logsTools(deps: AgentDeps, agent: AgentDefinition, context: OutsideAccessContext, azure: AzureAccess): ToolDefinition<any>[] {
  const resources = enabledResources(agent, azure, "appInsights", READ_AZURE_LOGS_INTEGRATION);

  if (resources.length === 0) {
    return [];
  }

  return [
    defineOutsideTool(deps.outside, context, {
      name: "azure_logs_query",
      description: "Run one KQL query on an App Insights component or Log Analytics workspace (as the signed-in user) and get the rows as a table, at most 200. Tables: requests, exceptions, traces, dependencies, customEvents (App Insights) or AppRequests, AppExceptions, AppTraces (workspace). Management commands are refused.",
      input: {
        resource: resourceChoice(resources),
        kql: z.string().min(1).describe("The query, e.g. exceptions | where timestamp > ago(1d) | summarize count() by type | top 10 by count_"),
        timespan: z.string().optional().describe("How far back: 30m, 24h (default) or 7d; at most 30d"),
      },
      resource: (input) => resourceOf("azureLogs", resources, input.resource),
      request: (input) => `${input.kql} [${input.timespan ?? "24h"}]`,
      handler: async (input) => answerResult(await azure.logs.query(targetOf(resources, input.resource), input.kql, input.timespan)),
    }),
  ];
}

function cosmosTools(deps: AgentDeps, agent: AgentDefinition, context: OutsideAccessContext, azure: AzureAccess): ToolDefinition<any>[] {
  const resources = enabledResources(agent, azure, "cosmos", READ_COSMOS_INTEGRATION);

  if (resources.length === 0) {
    return [];
  }

  return [
    defineOutsideTool(deps.outside, context, {
      name: "cosmos_describe",
      description: "List a Cosmos DB account's databases and containers with their partition keys; then query a container with cosmos_query.",
      input: { resource: resourceChoice(resources) },
      resource: (input) => resourceOf("cosmos", resources, input.resource),
      request: () => "list containers",
      handler: async (input) => answerResult(await azure.cosmos.listContainers(targetOf(resources, input.resource), secretOf(resources, input.resource))),
    }),
    defineOutsideTool(deps.outside, context, {
      name: "cosmos_query",
      description: "Run one Cosmos DB SQL query (SELECT) on a container and get the items as a table, at most 200; one row per item, one column per top-level field. The account's key is read-only.",
      input: {
        resource: resourceChoice(resources),
        database: z.string().min(1),
        container: z.string().min(1),
        sql: z.string().min(1).describe("e.g. SELECT TOP 20 c.id, c.status, c.updatedAt FROM c WHERE c.patientId = '42' ORDER BY c.updatedAt DESC"),
      },
      resource: (input) => resourceOf("cosmos", resources, input.resource),
      request: (input) => `${input.database}/${input.container}: ${input.sql}`,
      handler: async (input) => answerResult(await azure.cosmos.query(targetOf(resources, input.resource), secretOf(resources, input.resource), input.database, input.container, input.sql)),
    }),
  ];
}

// The kind's enabled resources, when the agent's and the vault's switches for the kind are on.
function enabledResources(agent: AgentDefinition, azure: AzureAccess, kind: AzureResourceKind, integration: string): AzureResourceSettings[] {
  const agentOn = agent.capabilities.integrations?.[integration] === true;
  const vaultOn = azure.settings.enabledKinds[kind] === true;

  return agentOn && vaultOn ? azure.settings.resources.filter((resource) => resource.kind === kind && resource.enabled) : [];
}

function resourceChoice(resources: AzureResourceSettings[]) {
  const names = resources.map((resource) => resource.name) as [string, ...string[]];

  return z.enum(names).describe(`The resource to read: ${resources.map((resource) => `${resource.name} (${resource.display})`).join("; ")}`);
}

function answerResult(answer: AzureAnswer): OutsideToolResult {
  if (!answer.ok) {
    return { text: answer.message, isError: true, refusal: answer.refused ? answer.message : undefined, denied: answer.denied };
  }

  const { columns, rows, truncated } = answer.rows;
  const notes = [truncated ? "[first 200 rows only: narrow the query]" : "", answer.note ?? ""].filter(Boolean);
  const text = [`${rows.length} row(s)`, toMarkdownTable(columns, rows), ...notes].join("\n\n");
  const cut = text.length > MAX_ANSWER_CHARS ? `\n\n[cut at ${MAX_ANSWER_CHARS} of ${text.length} characters: select fewer columns or rows]` : "";

  return { text: `${text.slice(0, MAX_ANSWER_CHARS)}${cut}`, rows: rows.length, truncated: truncated || cut.length > 0 };
}

function resourceOf(kind: OutsideResource["kind"], resources: AzureResourceSettings[], name: string): OutsideResource {
  const resource = find(resources, name);

  return { kind, resource: resource.name, target: resource.display };
}

function targetOf(resources: AzureResourceSettings[], name: string): string {
  return find(resources, name).target;
}

function secretOf(resources: AzureResourceSettings[], name: string): string {
  return find(resources, name).secret;
}

function find(resources: AzureResourceSettings[], name: string): AzureResourceSettings {
  return resources.find((resource) => resource.name === name)!;
}
