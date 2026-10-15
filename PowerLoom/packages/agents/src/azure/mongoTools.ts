import type { AgentDefinition } from "@agenttools/config";
import type { ToolDefinition } from "@agenttools/runtime";
import type { ConnectionStringAnswer } from "@powerloom/azure";
import type { AzureResourceSettings } from "@powerloom/core";
import type { MongoAnswer } from "@powerloom/mongo";
import { z } from "zod";
import type { AgentDeps } from "../models/AgentDeps";
import type { MongoAccess } from "../models/MongoAccess";
import type { OutsideAccessContext } from "../models/OutsideAccessContext";
import type { OutsideResource } from "../models/OutsideResource";
import type { OutsideToolResult } from "../models/OutsideToolResult";
import { defineOutsideTool } from "../outsideAccess";
import { READ_MONGO_INTEGRATION } from "./azureIntegrations";

// An answer's text is cut here so one wide result can't fill the agent's context (as for Read SQL).
const MAX_ANSWER_CHARS = 60_000;

const document = z.record(z.string(), z.unknown());

type Document = Record<string, unknown>;

type Connect = (target: string) => Promise<ConnectionStringAnswer>;

// The Mongo tools (user decisions 2026-10-14/15): the vault's enabled Mongo resources, each a Cosmos DB for MongoDB
// account read with the read-only connection string the sign-in fetches at call time, or a server outside Cosmos read
// with the connection string stored in Settings. Every call goes through the outside wrapper.
export function createMongoTools(deps: AgentDeps, agent: AgentDefinition, context: OutsideAccessContext): ToolDefinition<any>[] {
  const mongo = deps.azure?.mongo ?? null;
  const accounts = deps.azure?.settings.resources.filter((resource) => resource.kind === "mongo" && resource.enabled) ?? [];
  const isOn = agent.capabilities.integrations?.[READ_MONGO_INTEGRATION] === true && deps.azure?.settings.enabledKinds.mongo === true;

  if (!isOn || !mongo || accounts.length === 0) {
    return [];
  }

  const account = z.enum(accounts.map((entry) => entry.target) as [string, ...string[]]).describe(`The Mongo account or server: ${accounts.map(accountLabel).join("; ")}`);
  const connect: Connect = (target) => connectionOf(mongo, accounts, target);

  return [describeTool(deps, context, mongo, account, connect), findTool(deps, context, mongo, account, connect), aggregateTool(deps, context, mongo, account, connect)];
}

function describeTool(deps: AgentDeps, context: OutsideAccessContext, mongo: MongoAccess, account: z.ZodEnum<Record<string, string>>, connect: Connect): ToolDefinition<any> {
  return defineOutsideTool(deps.outside, context, {
    name: "mongo_describe",
    description: "List a Mongo account's or server's databases, or, with a database, its collections with the top-level fields of one sample document each. Then read with mongo_find or mongo_aggregate.",
    input: { account, database: z.string().optional().describe("A database name; leave out to list the databases") },
    resource: (input) => resourceOf(input.account),
    request: (input) => (input.database ? `describe ${input.database}` : "list databases"),
    handler: (input) => withConnection(connect, input.account, (connectionString) => mongo.reader.describe(connectionString, input.database ?? null)),
  });
}

function findTool(deps: AgentDeps, context: OutsideAccessContext, mongo: MongoAccess, account: z.ZodEnum<Record<string, string>>, connect: Connect): ToolDefinition<any> {
  return defineOutsideTool(deps.outside, context, {
    name: "mongo_find",
    description: "Find documents in a collection (read-only): a MongoDB filter, an optional projection and sort, at most 200 documents (20 by default). $where is refused.",
    input: {
      account,
      database: z.string().min(1),
      collection: z.string().min(1),
      filter: document.optional().describe('MongoDB filter, e.g. { "patientId": "42", "status": { "$in": ["open", "pending"] } }; empty = every document'),
      projection: document.optional().describe('Fields to return, e.g. { "_id": 0, "status": 1, "updatedAt": 1 }'),
      sort: document.optional().describe('e.g. { "updatedAt": -1 }'),
      limit: z.number().int().min(1).max(200).optional().describe("Documents to return, 1–200 (default 20)"),
    },
    resource: (input) => resourceOf(input.account),
    request: (input) => `${input.database}/${input.collection}: find ${JSON.stringify(input.filter ?? {})}${input.sort ? ` sort ${JSON.stringify(input.sort)}` : ""} limit ${input.limit ?? 20}`,
    handler: (input) => withConnection(connect, input.account, (connectionString) => mongo.reader.find(connectionString, input.database, input.collection, input.filter ?? {}, input.projection, input.sort, input.limit)),
  });
}

function aggregateTool(deps: AgentDeps, context: OutsideAccessContext, mongo: MongoAccess, account: z.ZodEnum<Record<string, string>>, connect: Connect): ToolDefinition<any> {
  return defineOutsideTool(deps.outside, context, {
    name: "mongo_aggregate",
    description: "Run an aggregation pipeline on a collection (read-only), at most 200 documents out. $out, $merge, $where, $function and $accumulator are refused.",
    input: {
      account,
      database: z.string().min(1),
      collection: z.string().min(1),
      pipeline: z.array(document).min(1).describe('The stages, e.g. [{ "$match": { "status": "open" } }, { "$group": { "_id": "$tenantId", "n": { "$sum": 1 } } }]'),
    },
    resource: (input) => resourceOf(input.account),
    request: (input) => `${input.database}/${input.collection}: aggregate ${JSON.stringify(input.pipeline)}`,
    handler: (input) => withConnection(connect, input.account, (connectionString) => mongo.reader.aggregate(connectionString, input.database, input.collection, input.pipeline as Document[])),
  });
}

// A server outside Cosmos has its connection string in Settings; a Cosmos account's is fetched with the sign-in.
function connectionOf(mongo: MongoAccess, accounts: AzureResourceSettings[], target: string): Promise<ConnectionStringAnswer> {
  const stored = accounts.find((entry) => entry.target === target)?.secret ?? "";

  return stored ? Promise.resolve({ ok: true, connectionString: stored }) : mongo.connectionStrings.readOnlyMongo(target);
}

// The connection string comes first; a refused fetch is the call's answer (denied when the sign-in is the problem).
async function withConnection(connect: Connect, account: string, read: (connectionString: string) => Promise<MongoAnswer>): Promise<OutsideToolResult> {
  const connection = await connect(account);

  if (!connection.ok) {
    return connectionResult(connection);
  }

  return answerResult(await read(connection.connectionString));
}

function connectionResult(answer: Extract<ConnectionStringAnswer, { ok: false }>): OutsideToolResult {
  return { text: answer.message, isError: true, denied: answer.denied };
}

function answerResult(answer: MongoAnswer): OutsideToolResult {
  if (!answer.ok) {
    return { text: answer.message, isError: true, refusal: answer.refused ? answer.message : undefined, denied: answer.denied };
  }

  const note = answer.truncated ? "\n\n[more documents than shown: narrow the filter or lower the limit]" : "";
  const text = `${answer.documents.length} document(s)\n\n${JSON.stringify(answer.documents, null, 1)}${note}`;
  const cut = text.length > MAX_ANSWER_CHARS ? `\n\n[cut at ${MAX_ANSWER_CHARS} of ${text.length} characters: project fewer fields or fewer documents]` : "";

  return { text: `${text.slice(0, MAX_ANSWER_CHARS)}${cut}`, rows: answer.documents.length, truncated: answer.truncated || cut.length > 0 };
}

function resourceOf(account: string): OutsideResource {
  return { kind: "mongo", resource: account, target: account };
}

function accountLabel(account: AzureResourceSettings): string {
  return `${account.target} (${account.name})`;
}
