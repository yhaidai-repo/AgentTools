import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AgentDefinition } from "@agenttools/config";
import type { DevHubClient } from "@powerloom/localstack";
import type { DataAccessLog } from "./DataAccessLog";
import { LOCAL_STACK_INTEGRATION, createLocalStackTools, stackOwner } from "./localStackTools";
import type { AgentDeps } from "./models/AgentDeps";
import type { DataAccessEntry } from "./models/DataAccessEntry";

const context = { vault: "work-projects", agentId: "tester", runId: 7, taskId: "AT-1-001", pbiId: 1 };

function agentWith(localStack: boolean): AgentDefinition {
  return { capabilities: { webAccess: false, integrations: { [LOCAL_STACK_INTEGRATION]: localStack } }, limits: { maxTurns: 40, timeoutMinutes: 20 } } as unknown as AgentDefinition;
}

function depsWith(client: Partial<DevHubClient> | null): { deps: AgentDeps; entries: DataAccessEntry[] } {
  const entries: DataAccessEntry[] = [];
  const log = { record: async (entry: DataAccessEntry) => { entries.push(entry); } } as unknown as DataAccessLog;
  const outside = { log, requests: { request: async () => ({ id: "HT-1-001", created: true }) } };
  const localStack = client ? { client: client as DevHubClient, url: "http://host.docker.internal:47811" } : null;

  return { deps: { outside, localStack } as unknown as AgentDeps, entries };
}

function toolNamed(deps: AgentDeps, name: string) {
  return createLocalStackTools(deps, agentWith(true), context).find((tool) => tool.name === name)!;
}

describe("createLocalStackTools", () => {
  it("gives no tools while the agent's switch or the vault's Local stack is off", () => {
    assert.equal(createLocalStackTools(depsWith({}).deps, agentWith(false), context).length, 0);
    assert.equal(createLocalStackTools(depsWith(null).deps, agentWith(true), context).length, 0);
  });

  it("gives the five stack tools when both are on", () => {
    const names = createLocalStackTools(depsWith({}).deps, agentWith(true), context).map((tool) => tool.name);

    assert.deepEqual(names, ["list_services", "start_stack", "stack_status", "stack_logs", "stop_stack"]);
  });

  it("lists the services as a table and logs the call as a local stack read", async () => {
    const services = async () => ({ ok: true as const, value: [{ name: "signals", note: "Signals AppHost", localUrl: "https://localhost:7456", consumesBus: false }] });
    const { deps, entries } = depsWith({ services });

    const result = await toolNamed(deps, "list_services").handler({});

    assert.match(result.text, /\| signals \| Signals AppHost \| https:\/\/localhost:7456 \| no \|/);
    assert.equal(entries[0].kind, "localStack");
    assert.equal(entries[0].outcome, "ok");
  });

  it("stops only as the run's owner", async () => {
    let owner = "";
    const stop = async (name: string) => {
      owner = name;

      return { ok: true as const, value: { output: ["Stopped signals"] } };
    };

    const result = await toolNamed(depsWith({ stop }).deps, "stop_stack").handler({});

    assert.equal(owner, stackOwner(7));
    assert.match(result.text, /^Stopped\./);
  });

  it("hands a refused token to the access request flow", async () => {
    const status = async () => ({ ok: false as const, message: "DevHub refused the token.", denied: true });
    const { deps, entries } = depsWith({ status });

    const result = await toolNamed(deps, "stack_status").handler({});

    assert.equal(result.isError, true);
    assert.equal(entries[0].outcome, "denied");
    assert.match(result.text, /HT-1-001/);
  });
});
