import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AgentDefinition } from "@agenttools/config";
import type { AzureResourceSettings } from "@powerloom/core";
import type { DataAccessLog } from "../DataAccessLog";
import type { AgentDeps } from "../models/AgentDeps";
import type { DataAccessEntry } from "../models/DataAccessEntry";
import { READ_MONGO_INTEGRATION } from "./azureIntegrations";
import { createMongoTools } from "./mongoTools";

const context = { vault: "work-projects", agentId: "tester", runId: 7, owner: "powerloom-run-7", taskId: "AT-1-001", pbiId: 1 };
const ON_PREM = "mongodb://reader:t3st-pw@10.0.0.7:27017/?authMechanism=SCRAM-SHA-256";
const FETCHED = "mongodb://acct:ro@acct.mongo.cosmos.azure.com:10255/?ssl=true";

const resources: AzureResourceSettings[] = [
  { name: "cosmos-mongo", kind: "mongo", target: "zz-dev-cosmos-mongo", secret: "", display: "zz-dev-cosmos-mongo", enabled: true },
  { name: "on-prem", kind: "mongo", target: "10.0.0.7:27017", secret: ON_PREM, display: "10.0.0.7:27017", enabled: true },
];

const agent = { capabilities: { webAccess: false, integrations: { [READ_MONGO_INTEGRATION]: true } } } as unknown as AgentDefinition;

function depsReading(used: string[], fetched: string[]): { deps: AgentDeps; entries: DataAccessEntry[] } {
  const entries: DataAccessEntry[] = [];
  const log = { record: async (entry: DataAccessEntry) => { entries.push(entry); } } as unknown as DataAccessLog;
  const outside = { log, requests: { request: async () => ({ id: "HT-1-001", created: true }) } };
  const reader = {
    find: async (connectionString: string) => {
      used.push(connectionString);

      return { ok: true as const, documents: [{ status: "open" }], truncated: false };
    },
  };
  const connectionStrings = {
    readOnlyMongo: async (account: string) => {
      fetched.push(account);

      return { ok: true as const, connectionString: FETCHED };
    },
  };
  const azure = { settings: { enabledKinds: { mongo: true }, resources, subscription: "" }, server: null, serviceBus: null, mongo: { reader, connectionStrings } };

  return { deps: { outside, azure } as unknown as AgentDeps, entries };
}

describe("createMongoTools", () => {
  it("reads a server outside Cosmos with its stored string and a Cosmos account with the fetched one", async () => {
    const used: string[] = [];
    const fetched: string[] = [];
    const { deps, entries } = depsReading(used, fetched);
    const find = createMongoTools(deps, agent, context).find((tool) => tool.name === "mongo_find")!;

    await find.handler({ account: "10.0.0.7:27017", database: "app", collection: "orders" });
    await find.handler({ account: "zz-dev-cosmos-mongo", database: "Staging", collection: "OrdResponseSummaries" });

    assert.deepEqual(used, [ON_PREM, FETCHED]);
    assert.deepEqual(fetched, ["zz-dev-cosmos-mongo"]);
    assert.deepEqual(entries.map((entry) => [entry.kind, entry.resource, entry.outcome]), [["mongo", "10.0.0.7:27017", "ok"], ["mongo", "zz-dev-cosmos-mongo", "ok"]]);
  });
});
