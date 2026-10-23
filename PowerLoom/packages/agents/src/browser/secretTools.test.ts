import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { DevHubClient } from "@powerloom/devhub";
import type { DataAccessLog } from "../DataAccessLog";
import type { AgentDeps } from "../models/AgentDeps";
import type { DataAccessEntry } from "../models/DataAccessEntry";
import { createSecretTools } from "./secretTools";

const context = { vault: "work-projects", agentId: "autotest", runId: 7, owner: "powerloom-run-7", taskId: "TT-1-001", pbiId: 1 };

function harness(client: Partial<DevHubClient>) {
  const entries: DataAccessEntry[] = [];
  const log = { record: async (entry: DataAccessEntry) => { entries.push(entry); } } as unknown as DataAccessLog;
  const deps = { outside: { log, requests: { request: async () => ({ id: "HT-1-001", created: true }) } } } as unknown as AgentDeps;
  const tools = createSecretTools(deps, context, { client: client as DevHubClient, url: "http://devhub" });

  return { tool: (name: string) => tools.find((tool) => tool.name === name)!, entries };
}

describe("createSecretTools", () => {
  it("lists the value names DevHub offers", async () => {
    const { tool } = harness({ secretNames: async () => ({ ok: true as const, value: { names: ["pvs-dev-user-yhaidai", "pvs-web-api-key"] } }) });

    const result = await tool("list_secret_names").handler({});

    assert.equal(result.text, "pvs-dev-user-yhaidai\npvs-web-api-key");
  });

  it("sends a request through DevHub and logs only the method and URL", async () => {
    let sent: unknown = null;
    const httpRequest = async (request: unknown) => {
      sent = request;

      return { ok: true as const, value: { status: 200, headers: { "Content-Type": "application/json" }, body: '{"id":1190908}', bodyCut: false } };
    };
    const { tool, entries } = harness({ httpRequest });

    const result = await tool("http_request").handler({ method: "GET", url: "https://localhost:5002/V1_0/Verifications/1190908", headers: { Authorization: "{{secret:pvs-web-api-key|basic}}" } });

    assert.deepEqual(sent, { method: "GET", url: "https://localhost:5002/V1_0/Verifications/1190908", headers: { Authorization: "{{secret:pvs-web-api-key|basic}}" } });
    assert.match(result.text, /^HTTP 200\nContent-Type: application\/json\n\n\{"id":1190908\}$/);
    assert.equal(entries[0].request, "GET https://localhost:5002/V1_0/Verifications/1190908");
    assert.equal(entries[0].resource, "localhost:5002");
  });

  it("marks a 5xx answer as an error for the agent", async () => {
    const { tool } = harness({ httpRequest: async () => ({ ok: true as const, value: { status: 500, headers: {}, body: "boom", bodyCut: false } }) });

    const result = await tool("http_request").handler({ method: "GET", url: "https://localhost:5002/x" });

    assert.equal(result.isError, true);
  });
});
