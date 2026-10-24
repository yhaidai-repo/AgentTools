import { nextItemId, nextScopedItemId, renderHumanTaskBody, type HumanTaskData } from "@powerloom/core";
import { localItem, type PowerLoomDb } from "@powerloom/db";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { AccessRequest } from "./models/AccessRequest";
import type { OutsideAccessContext } from "./models/OutsideAccessContext";
import type { OutsideResource } from "./models/OutsideResource";

type ItemData = { rerunAfter?: string[]; accessRequest?: { kind: string; resource: string; agentTaskId: string | null } };

// The fix a person makes per kind: what the human task asks for.
const FIXES: Record<string, string> = {
  sql: "Settings → Read SQL: Test the connection; the server refused its login. Fix the login or the connection string, or grant the login db_datareader.",
  confluence: "Check CONFLUENCE_EMAIL / CONFLUENCE_API_TOKEN in .env, and that the account may see the page.",
  azure: "Settings → Read Azure: sign in again with your account (the sign-in expired or was refused), or the account has no read role on the resource: ask an Azure admin for Reader on it.",
  cosmos: "Settings → Read Azure: sign in again with your account, or the account may not list the Cosmos DB account's keys: ask an Azure admin for Cosmos DB Account Reader on it.",
  serviceBus: "Settings → Read Azure → Service Bus: the namespace refused its connection string (a rotated key or a policy without Listen); remove the namespace and add it again with a current Listen-only connection string.",
  mongo: "Settings → Read Azure: sign in again with your account, or the account may not list the Cosmos DB for MongoDB account's connection strings: ask an Azure admin for Cosmos DB Account Reader on it. A server added by connection string: its user or password was refused; remove it and add it again with a current read-only user's string.",
  ado: "Settings → Azure DevOps: check that the PAT has Work Items (Read) and Code (Read) and hasn't expired; save a new one if it lacks a scope or has expired.",
};

const OPEN = ["open", "in-progress"] as const;

// A tool refused for access becomes one human task with the fix (user decision 2026-10-13), written at once, and the
// agent task gets the anchor `rerunAfter` so it runs again once the task is closed. One task per resource while it is
// open: a second refusal, in this run or a later one, reuses it.
export class AccessRequests {
  constructor(private readonly db: PowerLoomDb) {}

  async request(context: OutsideAccessContext, resource: OutsideResource, tool: string, reason: string): Promise<AccessRequest> {
    const existing = await this.openRequest(context.vault, resource);
    const request = existing ?? await this.create(context, resource, tool, reason);

    await this.anchor(context.taskId, request.id);

    return request;
  }

  private async openRequest(vault: string, resource: OutsideResource): Promise<AccessRequest | null> {
    const rows = await this.db
      .select({ id: localItem.id })
      .from(localItem)
      .where(and(eq(localItem.vault, vault), eq(localItem.kind, "human"), inArray(localItem.status, OPEN), sql`${localItem.data}->'accessRequest'->>'kind' = ${resource.kind}`, sql`${localItem.data}->'accessRequest'->>'resource' = ${resource.resource}`));

    return rows[0] ? { id: rows[0].id, created: false } : null;
  }

  private async create(context: OutsideAccessContext, resource: OutsideResource, tool: string, reason: string): Promise<AccessRequest> {
    const id = context.pbiId === null ? await nextScopedItemId(this.db, "HT-") : await nextItemId(this.db, "HT", context.pbiId);
    const data: HumanTaskData & ItemData = {
      why: `${context.agentId}'s ${tool} on ${resource.resource} was refused: ${reason.slice(0, 200)}`,
      solves: `Lets ${context.agentId} finish ${context.taskId ?? "its task"}; it runs again when this task is closed.`,
      steps: [{ action: FIXES[resource.kind] ?? `Restore ${context.agentId}'s access to ${resource.resource}.`, source: "portal", resource: `${resource.resource} (${resource.target})`, query: null, timeRange: null, reportBack: "Done, or why it can't be done" }],
      accessRequest: { kind: resource.kind, resource: resource.resource, agentTaskId: context.taskId },
    };

    await this.db.insert(localItem).values({
      id, kind: "human", pbiId: context.pbiId, vault: context.vault, parentId: context.taskId, title: `Access to ${resource.resource} for ${context.agentId}`.slice(0, 120), status: "open", assignee: "human",
      body: renderHumanTaskBody(data), data, createdByRun: context.runId,
    });

    return { id, created: true };
  }

  // The anchor on the agent task: the dispatcher holds it while the human task is open and reopens it when closed.
  private async anchor(taskId: string | null, requestId: string): Promise<void> {
    if (!taskId) {
      return;
    }

    const [task] = await this.db.select({ data: localItem.data }).from(localItem).where(eq(localItem.id, taskId));
    const data = (task?.data ?? {}) as ItemData;
    const rerunAfter = data.rerunAfter ?? [];

    if (rerunAfter.includes(requestId)) {
      return;
    }

    await this.db.update(localItem).set({ data: { ...data, rerunAfter: [...rerunAfter, requestId] } }).where(eq(localItem.id, taskId));
  }
}
