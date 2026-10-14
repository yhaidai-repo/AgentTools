import type { ToolDefinition } from "@agenttools/runtime";
import { FIELD, type AdoClient } from "@powerloom/ado";
import { z } from "zod";
import type { AdoAccess } from "../models/AdoAccess";
import type { AgentDeps } from "../models/AgentDeps";
import type { OutsideAccessContext } from "../models/OutsideAccessContext";
import type { OutsideToolResult } from "../models/OutsideToolResult";
import { defineOutsideTool } from "../outsideAccess";
import { WORK_ITEMS, adoFailure, adoResource, limitedResult } from "./adoToolResults";
import { workItemListText, workItemMarkdown } from "./workItemMarkdown";

const DEFAULT_COMMENTS = 20;
const MAX_COMMENTS = 100;
const DEFAULT_QUERY_ROWS = 50;
const MAX_QUERY_ROWS = 200;
const LIST_FIELDS: string[] = [FIELD.type, FIELD.title, FIELD.state, FIELD.assignedTo, FIELD.iterationPath];

export function workItemTools(deps: AgentDeps, context: OutsideAccessContext, access: AdoAccess): ToolDefinition<any>[] {
  return [readWorkItemTool(deps, context, access), queryWorkItemsTool(deps, context, access)];
}

function readWorkItemTool(deps: AgentDeps, context: OutsideAccessContext, access: AdoAccess) {
  return defineOutsideTool(deps.outside, context, {
    name: "read_work_item",
    description: "Read any Azure DevOps work item live from ADO by its id (bug, task, PBI, feature, test case): its fields, description, links (parent, children, related items, pull requests, commits) and the newest discussion comments. For a PBI of PowerLoom's backlog, read_pbi has its prepared context.",
    input: {
      id: z.number().int().positive().describe("The work item id, e.g. 36973"),
      comments: z.number().int().min(0).max(MAX_COMMENTS).optional().describe(`How many of the newest discussion comments to read (default ${DEFAULT_COMMENTS}, 0 for none)`),
    },
    resource: () => adoResource(access, WORK_ITEMS),
    request: (input) => `work item ${input.id}`,
    handler: async (input) => readWorkItem(access.client, input.id, input.comments ?? DEFAULT_COMMENTS),
  });
}

function queryWorkItemsTool(deps: AgentDeps, context: OutsideAccessContext, access: AdoAccess) {
  return defineOutsideTool(deps.outside, context, {
    name: "query_work_items",
    description: "Find Azure DevOps work items with a flat WIQL query (SELECT [System.Id] FROM WorkItems WHERE ...); lists id, type, state, title, assignee and iteration. Read one in full with read_work_item.",
    input: {
      wiql: z.string().min(10).describe("A flat WIQL query, e.g. SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = @project AND [System.Title] CONTAINS 'HCPCS' ORDER BY [System.ChangedDate] DESC"),
      top: z.number().int().min(1).max(MAX_QUERY_ROWS).optional().describe(`At most this many items (default ${DEFAULT_QUERY_ROWS})`),
    },
    resource: () => adoResource(access, WORK_ITEMS),
    request: (input) => input.wiql,
    handler: async (input) => queryWorkItems(access.client, input.wiql, input.top ?? DEFAULT_QUERY_ROWS),
  });
}

async function readWorkItem(client: AdoClient, id: number, commentCount: number): Promise<OutsideToolResult> {
  try {
    const item = await client.getWorkItem(id);
    const comments = commentCount === 0 ? null : await client.getWorkItemComments(id, commentCount);

    return limitedResult(workItemMarkdown(item, comments), 1);
  } catch (error) {
    return adoFailure(error);
  }
}

async function queryWorkItems(client: AdoClient, wiql: string, top: number): Promise<OutsideToolResult> {
  try {
    const ids = await client.queryIds(wiql, top);
    const items = await client.getWorkItems(ids, LIST_FIELDS);

    return limitedResult(workItemListText(items), items.length);
  } catch (error) {
    return adoFailure(error);
  }
}
